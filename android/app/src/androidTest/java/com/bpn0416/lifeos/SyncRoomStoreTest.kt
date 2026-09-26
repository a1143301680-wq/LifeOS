package com.bpn0416.lifeos

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.UUID
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SyncRoomStoreTest {
    private lateinit var context: Context
    private lateinit var database: LifeOSDatabase
    private lateinit var store: RoomSyncPageStore

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        database = Room.inMemoryDatabaseBuilder(context, LifeOSDatabase::class.java).build()
        store = RoomSyncPageStore(database)
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun identicalIdsAndCursorsRemainOwnerScoped() = runBlocking {
        val entityId = UUID.randomUUID().toString()
        store.apply(OWNER_ONE, SyncPage(0, listOf(categoryChange(1, entityId, "One")), 1, false))
        store.apply(OWNER_TWO, SyncPage(0, listOf(categoryChange(2, entityId, "Two")), 2, false))

        assertEquals("One", database.cacheDao().category(OWNER_ONE, entityId)?.name)
        assertEquals("Two", database.cacheDao().category(OWNER_TWO, entityId)?.name)
        assertEquals(1L, store.cursor(OWNER_ONE))
        assertEquals(2L, store.cursor(OWNER_TWO))

        store.apply(OWNER_ONE, SyncPage(1, listOf(categoryDelete(3, entityId)), 3, false))
        assertNull(database.cacheDao().category(OWNER_ONE, entityId))
        assertEquals("Two", database.cacheDao().category(OWNER_TWO, entityId)?.name)
    }

    @Test
    fun todoUpsertAndTombstoneAreOwnerScoped() = runBlocking {
        val entityId = UUID.randomUUID().toString()
        store.apply(OWNER_ONE, SyncPage(0, listOf(todoChange(1, entityId, "One")), 1, false))
        store.apply(OWNER_TWO, SyncPage(0, listOf(todoChange(2, entityId, "Two")), 2, false))

        assertEquals("One", database.cacheDao().todo(OWNER_ONE, entityId)?.title)
        assertEquals("Two", database.cacheDao().todo(OWNER_TWO, entityId)?.title)

        store.apply(OWNER_ONE, SyncPage(1, listOf(SyncChange.TodoDelete(3, entityId)), 3, false))
        assertNull(database.cacheDao().todo(OWNER_ONE, entityId))
        assertEquals("Two", database.cacheDao().todo(OWNER_TWO, entityId)?.title)
    }

    @Test
    fun pageAndCursorRollbackTogetherOnDatabaseFailure() = runBlocking {
        val validId = UUID.randomUUID().toString()
        database.openHelper.writableDatabase.execSQL(
            """
            CREATE TRIGGER fail_category_insert
            BEFORE INSERT ON cached_todo_categories
            WHEN NEW.name = 'Fail'
            BEGIN
                SELECT RAISE(ABORT, 'fixture database failure');
            END
            """.trimIndent(),
        )
        val duplicate = listOf(
            categoryChange(1, validId, "First"),
            categoryChange(2, UUID.randomUUID().toString(), "Fail"),
        )

        assertEquals(true, runCatching { store.apply(OWNER_ONE, SyncPage(0, duplicate, 2, false)) }.isFailure)

        assertNull(database.cacheDao().category(OWNER_ONE, validId))
        assertEquals(0L, store.cursor(OWNER_ONE))
    }

    @Test
    fun fileDatabasePersistsAcrossReopen() = runBlocking {
        database.close()
        val name = "sync-${UUID.randomUUID()}.db"
        try {
            val first = Room.databaseBuilder(context, LifeOSDatabase::class.java, name).build()
            try {
                RoomSyncPageStore(first).apply(OWNER_ONE, SyncPage(0, emptyList(), 8, false))
            } finally {
                first.close()
            }
            val reopened = Room.databaseBuilder(context, LifeOSDatabase::class.java, name).build()
            try {
                assertEquals(8L, RoomSyncPageStore(reopened).cursor(OWNER_ONE))
            } finally {
                reopened.close()
            }
        } finally {
            context.deleteDatabase(name)
        }
    }

    @Test
    fun corruptCursorAndStalePageFailClosed() = runBlocking {
        database.cacheDao().putSyncState(SyncState(OWNER_ONE, -1))
        assertEquals(true, runCatching { store.cursor(OWNER_ONE) }.isFailure)

        database.cacheDao().putSyncState(SyncState(OWNER_ONE, 4))
        val result = runCatching {
            store.apply(
                OWNER_ONE,
                SyncPage(3, listOf(categoryChange(4, UUID.randomUUID().toString(), "Late")), 4, false),
            )
        }
        assertEquals(true, result.isFailure)
        assertEquals(4L, store.cursor(OWNER_ONE))
    }

    private fun categoryChange(cursor: Long, id: String, name: String) = SyncChange.CategoryUpsert(
        cursor,
        CachedTodoCategory(OWNER_ONE, id, name, null, null, false, 0, "2026-09-26T12:00:00+08:00", "2026-09-26T12:00:00+08:00", cursor),
    )

    private fun categoryDelete(cursor: Long, id: String) = SyncChange.CategoryDelete(cursor, id)

    private fun todoChange(cursor: Long, id: String, title: String) = SyncChange.TodoUpsert(
        cursor,
        CachedTodo(
            ownerId = OWNER_ONE,
            entityId = id,
            categoryId = null,
            categoryName = null,
            categoryIsDeleted = null,
            title = title,
            note = null,
            status = "pending",
            priority = "medium",
            plannedDate = null,
            dueAt = null,
            completedAt = null,
            version = 1,
            createdAt = "2026-09-26T12:00:00+08:00",
            updatedAt = "2026-09-26T12:00:00+08:00",
            lastSyncCursor = cursor,
        ),
    )

    companion object {
        private const val OWNER_ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        private const val OWNER_TWO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    }
}
