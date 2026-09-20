package com.bpn0416.lifeos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    private val identityViewModel: IdentityViewModel by viewModels {
        IdentityViewModelFactory(application)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val state by identityViewModel.uiState.collectAsStateWithLifecycle()
            LifeOSApp(
                identityState = state,
                onConnect = identityViewModel::connect,
                onRetry = identityViewModel::retry,
                onSwitchIdentity = identityViewModel::switchIdentity,
            )
        }
    }
}
