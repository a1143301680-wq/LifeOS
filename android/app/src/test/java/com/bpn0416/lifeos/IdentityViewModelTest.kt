package com.bpn0416.lifeos

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class IdentityViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun validNewTokenIsTrimmedAndPersistedOnlyAfterValidation() = runTest(dispatcher) {
        val store = FakeIdentityStore()
        val client = FakeIdentityClient()
        val response = CompletableDeferred<IdentityResult>()
        client.responses += response
        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        viewModel.connect("  fixture-token  ")
        dispatcher.scheduler.runCurrent()
        assertNull(store.session)
        assertEquals("fixture-token", client.tokens.single())

        response.complete(IdentityResult.Success(profile))
        advanceUntilIdle()

        assertEquals("fixture-token", store.session?.token)
        assertEquals(IdentityUiState.Connected(profile), viewModel.uiState.value)
    }

    @Test
    fun emptyTokenIsRejectedWithoutRequestOrPersistence() = runTest(dispatcher) {
        val store = FakeIdentityStore()
        val client = FakeIdentityClient()
        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        viewModel.connect("   ")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is IdentityUiState.Disconnected)
        assertTrue(client.tokens.isEmpty())
        assertNull(store.session)
    }

    @Test
    fun savedSessionIsRevalidatedAndRecoverableFailureRetainsIt() = runTest(dispatcher) {
        val saved = IdentitySession("saved-fixture", profile)
        val store = FakeIdentityStore(saved)
        val client = FakeIdentityClient().apply {
            responses += CompletableDeferred(IdentityResult.Recoverable)
        }
        val viewModel = IdentityViewModel(store, client, dispatcher)

        advanceUntilIdle()

        assertEquals(saved, store.session)
        assertEquals(IdentityUiState.Unavailable(profile, hasSavedSession = true), viewModel.uiState.value)
    }

    @Test
    fun savedSessionIsRevalidatedToConnectedState() = runTest(dispatcher) {
        val saved = IdentitySession("saved-fixture", profile)
        val store = FakeIdentityStore(saved)
        val client = FakeIdentityClient().apply {
            responses.addLast(CompletableDeferred(IdentityResult.Success(profile)))
        }

        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        assertEquals(listOf("saved-fixture"), client.tokens)
        assertEquals(IdentityUiState.Connected(profile), viewModel.uiState.value)
        assertEquals(saved, store.session)
    }

    @Test
    fun recoverableFailureForNewTokenDoesNotPersistAndCanRetry() = runTest(dispatcher) {
        val store = FakeIdentityStore()
        val client = FakeIdentityClient().apply {
            responses.addLast(CompletableDeferred(IdentityResult.Recoverable))
            responses.addLast(CompletableDeferred(IdentityResult.Success(profile)))
        }
        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        viewModel.connect("fixture-token")
        advanceUntilIdle()
        assertNull(store.session)
        assertEquals(IdentityUiState.Unavailable(null, hasSavedSession = false), viewModel.uiState.value)

        viewModel.retry()
        advanceUntilIdle()
        assertEquals("fixture-token", store.session?.token)
        assertEquals(listOf("fixture-token", "fixture-token"), client.tokens)
    }

    @Test
    fun unauthorizedClearsSavedSession() = runTest(dispatcher) {
        val store = FakeIdentityStore(IdentitySession("saved-fixture", profile))
        val client = FakeIdentityClient().apply {
            responses += CompletableDeferred(IdentityResult.Unauthorized)
        }
        val viewModel = IdentityViewModel(store, client, dispatcher)

        advanceUntilIdle()

        assertNull(store.session)
        assertTrue(viewModel.uiState.value is IdentityUiState.Unauthorized)
    }

    @Test
    fun switchDuringValidationPreventsStaleResponseFromRestoringIdentity() = runTest(dispatcher) {
        val store = FakeIdentityStore()
        val client = FakeIdentityClient()
        val response = CompletableDeferred<IdentityResult>()
        client.responses += response
        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        viewModel.connect("fixture-token")
        dispatcher.scheduler.runCurrent()
        viewModel.switchIdentity()
        response.complete(IdentityResult.Success(profile))
        advanceUntilIdle()

        assertNull(store.session)
        assertTrue(viewModel.uiState.value is IdentityUiState.Disconnected)
    }

    @Test
    fun duplicateConnectDoesNotStartCompetingRequest() = runTest(dispatcher) {
        val store = FakeIdentityStore()
        val client = FakeIdentityClient().apply {
            responses += CompletableDeferred()
        }
        val viewModel = IdentityViewModel(store, client, dispatcher)
        advanceUntilIdle()

        viewModel.connect("fixture-token")
        viewModel.connect("other-fixture")
        dispatcher.scheduler.runCurrent()

        assertEquals(listOf("fixture-token"), client.tokens)
    }

    private class FakeIdentityStore(
        initial: IdentitySession? = null,
    ) : IdentityStore {
        var session: IdentitySession? = initial

        override suspend fun load(): IdentitySession? = session

        override suspend fun save(session: IdentitySession) {
            this.session = session
        }

        override suspend fun clear() {
            session = null
        }
    }

    private class FakeIdentityClient : IdentityClient {
        val responses = ArrayDeque<CompletableDeferred<IdentityResult>>()
        val tokens = mutableListOf<String>()

        override suspend fun getMe(token: String): IdentityResult {
            tokens += token
            return responses.removeFirst().await()
        }
    }

    companion object {
        private val profile = IdentityProfile(
            id = "6f4a5620-8f67-4f15-bc2a-4e443fc8071c",
            alias = "me",
            displayName = "Me",
            timezone = "Asia/Shanghai",
        )
    }
}
