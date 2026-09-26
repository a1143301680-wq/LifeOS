package com.bpn0416.lifeos

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SyncClientCoordinatorTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun requestUsesBearerCursorAndBoundedLimitOnly() = runBlocking {
        server.enqueue(MockResponse().setBody(emptyPage(12)))
        val result = OkHttpSyncClient(server.url("api/v1/").toString()).fetch("secret-fixture", 7, 100)
        val request = server.takeRequest()

        assertTrue(result is SyncFetchResult.Page)
        assertEquals("/api/v1/sync/changes?cursor=7&limit=100", request.path)
        assertEquals("Bearer secret-fixture", request.getHeader("Authorization"))
        assertEquals("application/json", request.getHeader("Accept"))
        assertEquals(0L, request.bodySize)
        assertFalse(request.requestUrl.toString().contains("secret-fixture"))
        assertFalse(request.requestUrl!!.queryParameterNames.contains("user_id"))
    }

    @Test
    fun classifiesUnauthorizedFutureCursorMalformedAndTimeout() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody(error("unauthorized")))
        server.enqueue(MockResponse().setResponseCode(400).setBody(error("validation_error")))
        server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))
        server.enqueue(MockResponse().setBody(emptyPage(0)).setBodyDelay(1, TimeUnit.SECONDS))
        val shortClient = OkHttpClient.Builder().callTimeout(100, TimeUnit.MILLISECONDS).build()
        val normal = OkHttpSyncClient(server.url("api/v1/").toString())

        assertEquals(SyncFetchResult.Unauthorized, normal.fetch("fixture", 0, 100))
        assertEquals(SyncFetchResult.InvalidCursor, normal.fetch("fixture", 50, 100))
        assertTrue(normal.fetch("fixture", 0, 100) is SyncFetchResult.InvalidPage)
        assertEquals(SyncFetchResult.Recoverable, OkHttpSyncClient(server.url("api/v1/").toString(), shortClient).fetch("fixture", 0, 100))
    }

    @Test
    fun coordinatorCommitsPagesResumesAndRejectsDuplicateRun() = runBlocking {
        val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        val store = FakeSyncPageStore()
        val gate = CompletableDeferred<Unit>()
        val client = FakeSyncClient(
            mutableListOf(
                SyncFetchResult.Page(SyncPage(0, emptyList(), 5, true)),
                SyncFetchResult.Recoverable,
                SyncFetchResult.Page(SyncPage(5, emptyList(), 9, false)),
            ),
            gate,
        )
        val coordinator = SyncCoordinator(store, client)

        val first = async { coordinator.sync(owner, "fixture") }
        gate.await()
        assertEquals(SyncRunResult.AlreadyRunning, coordinator.sync(owner, "fixture"))
        client.release.complete(Unit)
        assertEquals(SyncRunResult.Recoverable(5), first.await())
        assertEquals(SyncRunResult.Completed(9), coordinator.sync(owner, "fixture"))
        assertEquals(listOf(0L, 5L, 5L), client.requestedCursors)
    }

    @Test
    fun coordinatorReturnsTypedTerminalResultsWithoutAdvancing() = runBlocking {
        val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        val terminalResults = listOf(
            SyncFetchResult.Unauthorized to SyncRunResult.Unauthorized,
            SyncFetchResult.InvalidCursor to SyncRunResult.InvalidLocalState(0),
            SyncFetchResult.InvalidPage to SyncRunResult.InvalidPage(0),
        )
        terminalResults.forEach { (fetchResult, expected) ->
            val store = FakeSyncPageStore()
            assertEquals(expected, SyncCoordinator(store, ImmediateSyncClient(fetchResult)).sync(owner, "fixture"))
            assertEquals(0L, store.cursor(owner))
        }
    }

    @Test
    fun coordinatorReportsCancellationAndDatabaseFailure() = runBlocking {
        val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        val cancelling = object : SyncClient {
            override suspend fun fetch(token: String, cursor: Long, limit: Int): SyncFetchResult {
                throw CancellationException("fixture")
            }
        }
        assertEquals(
            SyncRunResult.Cancelled(0),
            SyncCoordinator(FakeSyncPageStore(), cancelling).sync(owner, "fixture"),
        )

        val failingStore = object : SyncPageStore {
            override suspend fun cursor(ownerId: String) = 0L
            override suspend fun apply(ownerId: String, page: SyncPage) {
                throw IllegalStateException("stale cursor")
            }
        }
        val page = SyncFetchResult.Page(SyncPage(0, emptyList(), 3, false))
        assertEquals(
            SyncRunResult.DatabaseFailure(0),
            SyncCoordinator(failingStore, ImmediateSyncClient(page)).sync(owner, "fixture"),
        )
    }

    @Test
    fun cursorLoadCancellationReturnsCancelledAndReleasesOwnerLock() = runBlocking {
        val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        var cursorLoads = 0
        val store = object : SyncPageStore {
            override suspend fun cursor(ownerId: String): Long {
                cursorLoads += 1
                if (cursorLoads == 1) throw CancellationException("fixture")
                return 0L
            }

            override suspend fun apply(ownerId: String, page: SyncPage) = Unit
        }
        val page = SyncFetchResult.Page(SyncPage(0, emptyList(), 0, false))
        val coordinator = SyncCoordinator(store, ImmediateSyncClient(page))

        assertEquals(SyncRunResult.Cancelled(0), coordinator.sync(owner, "fixture"))
        assertEquals(SyncRunResult.Completed(0), coordinator.sync(owner, "fixture"))
        assertEquals(2, cursorLoads)
    }

    private fun emptyPage(cursor: Long) = """{"items":[],"next_cursor":$cursor,"has_more":false,"server_time":"2026-09-26T12:00:00+08:00"}"""
    private fun error(code: String) = """{"error":{"code":"$code","message":"x","details":{}},"server_time":"2026-09-26T12:00:00+08:00"}"""

    private class FakeSyncPageStore : SyncPageStore {
        private var cursor = 0L
        override suspend fun cursor(ownerId: String): Long = cursor
        override suspend fun apply(ownerId: String, page: SyncPage) {
            check(cursor == page.requestedCursor)
            cursor = page.nextCursor
        }
    }

    private class FakeSyncClient(
        private val responses: MutableList<SyncFetchResult>,
        private val gate: CompletableDeferred<Unit>,
    ) : SyncClient {
        val requestedCursors = mutableListOf<Long>()
        val release = CompletableDeferred<Unit>()

        override suspend fun fetch(token: String, cursor: Long, limit: Int): SyncFetchResult {
            requestedCursors += cursor
            if (requestedCursors.size == 2) {
                gate.complete(Unit)
                release.await()
            }
            return responses.removeAt(0)
        }
    }

    private class ImmediateSyncClient(private val result: SyncFetchResult) : SyncClient {
        override suspend fun fetch(token: String, cursor: Long, limit: Int) = result
    }
}
