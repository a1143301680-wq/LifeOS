package com.bpn0416.lifeos

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface IdentityUiState {
    data object Loading : IdentityUiState

    data class Disconnected(val message: String? = null) : IdentityUiState

    data class Validating(val cachedProfile: IdentityProfile? = null) : IdentityUiState

    data class Connected(val profile: IdentityProfile) : IdentityUiState

    data class Unavailable(
        val cachedProfile: IdentityProfile?,
        val hasSavedSession: Boolean,
    ) : IdentityUiState

    data class Unauthorized(val message: String = "That token is no longer valid.") : IdentityUiState
}

class IdentityViewModel(
    private val store: IdentityStore,
    private val client: IdentityClient,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Main.immediate,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow<IdentityUiState>(IdentityUiState.Loading)
    val uiState: StateFlow<IdentityUiState> = mutableUiState.asStateFlow()

    private val generation = AtomicLong(0)
    private val storageMutex = Mutex()
    private var requestJob: Job? = null
    private var savedSession: IdentitySession? = null
    private var pendingToken: String? = null

    init {
        viewModelScope.launch(dispatcher) {
            val restored = store.load()
            savedSession = restored
            if (restored == null) {
                mutableUiState.value = IdentityUiState.Disconnected()
            } else {
                pendingToken = restored.token
                startValidation(restored.token, restored)
            }
        }
    }

    fun connect(rawToken: String) {
        if (requestJob?.isActive == true) return
        val token = rawToken.trim()
        if (token.isEmpty()) {
            mutableUiState.value = IdentityUiState.Disconnected("Enter a token to continue.")
            return
        }
        pendingToken = token
        startValidation(token, existingSession = null)
    }

    fun retry() {
        if (requestJob?.isActive == true) return
        val token = savedSession?.token ?: pendingToken ?: return
        startValidation(token, savedSession)
    }

    fun switchIdentity() {
        val operation = generation.incrementAndGet()
        requestJob?.cancel()
        requestJob = null
        pendingToken = null
        mutableUiState.value = IdentityUiState.Loading
        viewModelScope.launch(dispatcher) {
            storageMutex.withLock {
                store.clear()
                savedSession = null
                if (generation.get() == operation) {
                    mutableUiState.value = IdentityUiState.Disconnected()
                }
            }
        }
    }

    private fun startValidation(token: String, existingSession: IdentitySession?) {
        val operation = generation.incrementAndGet()
        mutableUiState.value = IdentityUiState.Validating(existingSession?.profile)
        requestJob = viewModelScope.launch(dispatcher) {
            val result = try {
                client.getMe(token)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                IdentityResult.Recoverable
            }
            if (generation.get() != operation) return@launch

            try {
                when (result) {
                    is IdentityResult.Success -> persistSuccess(operation, token, result.profile)
                    IdentityResult.Unauthorized -> clearUnauthorized(operation)
                    IdentityResult.Recoverable -> showUnavailable(existingSession)
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                if (generation.get() == operation) showUnavailable(existingSession)
            }
        }
    }

    private fun showUnavailable(existingSession: IdentitySession?) {
        mutableUiState.value = IdentityUiState.Unavailable(
            cachedProfile = existingSession?.profile,
            hasSavedSession = existingSession != null,
        )
    }

    private suspend fun persistSuccess(operation: Long, token: String, profile: IdentityProfile) {
        val session = IdentitySession(token, profile)
        storageMutex.withLock {
            if (generation.get() != operation) return
            store.save(session)
            if (generation.get() != operation) return
            savedSession = session
            pendingToken = null
            mutableUiState.value = IdentityUiState.Connected(profile)
        }
    }

    private suspend fun clearUnauthorized(operation: Long) {
        storageMutex.withLock {
            if (generation.get() != operation) return
            store.clear()
            if (generation.get() != operation) return
            savedSession = null
            pendingToken = null
            mutableUiState.value = IdentityUiState.Unauthorized()
        }
    }
}

class IdentityViewModelFactory(
    private val application: Application,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(IdentityViewModel::class.java))
        return IdentityViewModel(
            store = PreferencesIdentityStore(application),
            client = OkHttpIdentityClient(BuildConfig.API_BASE_URL),
        ) as T
    }
}
