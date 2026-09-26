package com.bpn0416.lifeos

import androidx.room.withTransaction
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex

interface SyncPageStore {
    suspend fun cursor(ownerId: String): Long
    suspend fun apply(ownerId: String, page: SyncPage)
}

class RoomSyncPageStore(private val database: LifeOSDatabase) : SyncPageStore {
    override suspend fun cursor(ownerId: String): Long {
        requireOwner(ownerId)
        return (database.cacheDao().syncState(ownerId)?.cursor ?: 0L).also { require(it >= 0) }
    }

    override suspend fun apply(ownerId: String, page: SyncPage) {
        requireOwner(ownerId)
        require(page.requestedCursor >= 0 && page.nextCursor >= page.requestedCursor)
        database.withTransaction {
            val dao = database.cacheDao()
            val current = dao.syncState(ownerId)?.cursor ?: 0L
            check(current >= 0 && current == page.requestedCursor) { "Sync cursor changed before page apply." }
            page.changes.forEach { change ->
                check(change.cursor > current && change.cursor <= page.nextCursor)
                when (change) {
                    is SyncChange.TodoUpsert -> dao.upsertTodo(change.todo.copy(ownerId = ownerId))
                    is SyncChange.TodoDelete -> dao.deleteTodo(ownerId, change.entityId)
                    is SyncChange.CategoryUpsert -> dao.upsertCategory(change.category.copy(ownerId = ownerId))
                    is SyncChange.CategoryDelete -> dao.deleteCategory(ownerId, change.entityId)
                }
            }
            dao.putSyncState(SyncState(ownerId, page.nextCursor))
        }
    }

    private fun requireOwner(ownerId: String) {
        UUID.fromString(ownerId)
    }
}

sealed interface SyncRunResult {
    data class Completed(val cursor: Long) : SyncRunResult
    data class Recoverable(val cursor: Long) : SyncRunResult
    data class InvalidLocalState(val cursor: Long) : SyncRunResult
    data class InvalidPage(val cursor: Long) : SyncRunResult
    data class DatabaseFailure(val cursor: Long) : SyncRunResult
    data class Cancelled(val cursor: Long) : SyncRunResult
    data object Unauthorized : SyncRunResult
    data object AlreadyRunning : SyncRunResult
}

class SyncCoordinator(
    private val store: SyncPageStore,
    private val client: SyncClient,
    private val pageLimit: Int = 100,
) {
    private val ownerLocks = ConcurrentHashMap<String, Mutex>()

    init {
        require(pageLimit in 1..500)
    }

    suspend fun sync(ownerId: String, token: String): SyncRunResult {
        if (runCatching { UUID.fromString(ownerId) }.isFailure || token.isBlank()) {
            return SyncRunResult.InvalidLocalState(0)
        }
        val lock = ownerLocks.computeIfAbsent(ownerId) { Mutex() }
        if (!lock.tryLock()) return SyncRunResult.AlreadyRunning
        var cursor = 0L
        try {
            cursor = try {
                store.cursor(ownerId)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                return SyncRunResult.InvalidLocalState(0)
            }
            while (true) {
                when (val fetched = client.fetch(token, cursor, pageLimit)) {
                    is SyncFetchResult.Page -> {
                        try {
                            store.apply(ownerId, fetched.page)
                        } catch (_: CancellationException) {
                            return SyncRunResult.Cancelled(cursor)
                        } catch (_: Exception) {
                            return SyncRunResult.DatabaseFailure(cursor)
                        }
                        cursor = fetched.page.nextCursor
                        if (!fetched.page.hasMore) return SyncRunResult.Completed(cursor)
                    }
                    SyncFetchResult.Unauthorized -> return SyncRunResult.Unauthorized
                    SyncFetchResult.Recoverable -> return SyncRunResult.Recoverable(cursor)
                    SyncFetchResult.InvalidCursor -> return SyncRunResult.InvalidLocalState(cursor)
                    SyncFetchResult.InvalidPage -> return SyncRunResult.InvalidPage(cursor)
                }
            }
        } catch (_: CancellationException) {
            return SyncRunResult.Cancelled(cursor)
        } finally {
            lock.unlock()
        }
    }
}
