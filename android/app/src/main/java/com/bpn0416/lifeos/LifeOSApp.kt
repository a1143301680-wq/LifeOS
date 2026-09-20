package com.bpn0416.lifeos

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LightColors = lightColorScheme(
    primary = Color(0xFF006B5F),
    secondary = Color(0xFF8A4F00),
    tertiary = Color(0xFF4C5D92),
    background = Color(0xFFF7F9F7),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFE4ECE8),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF58DBC7),
    secondary = Color(0xFFFFB867),
    tertiary = Color(0xFFBAC6FF),
    background = Color(0xFF101513),
    surface = Color(0xFF171D1A),
    surfaceVariant = Color(0xFF26322E),
)

@Composable
fun LifeOSApp(
    identityState: IdentityUiState,
    onConnect: (String) -> Unit,
    onRetry: () -> Unit,
    onSwitchIdentity: () -> Unit,
) {
    LifeOSTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
            Column(modifier = Modifier.windowInsetsPadding(WindowInsets.safeDrawing)) {
                BrandBar()
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                IdentityContent(
                    state = identityState,
                    onConnect = onConnect,
                    onRetry = onRetry,
                    onSwitchIdentity = onSwitchIdentity,
                )
            }
        }
    }
}

@Composable
private fun BrandBar() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .padding(horizontal = 20.dp, vertical = 12.dp)
            .semantics { contentDescription = "LifeOS application" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "L",
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            text = "LifeOS",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun IdentityContent(
    state: IdentityUiState,
    onConnect: (String) -> Unit,
    onRetry: () -> Unit,
    onSwitchIdentity: () -> Unit,
) {
    var tokenInput by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(state) {
        if (state is IdentityUiState.Connected || state is IdentityUiState.Unauthorized) {
            tokenInput = ""
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 560.dp)
                .padding(horizontal = 20.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Identity",
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Connect this device to your LifeOS space.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            when (state) {
                IdentityUiState.Loading -> ProgressState("Loading saved identity")
                is IdentityUiState.Validating -> ProgressState(
                    if (state.cachedProfile == null) "Checking identity" else "Reconnecting identity",
                )
                is IdentityUiState.Connected -> ConnectedState(state.profile, onSwitchIdentity)
                is IdentityUiState.Disconnected -> TokenEntry(
                    token = tokenInput,
                    message = state.message,
                    onTokenChange = { tokenInput = it },
                    onConnect = { onConnect(tokenInput) },
                )
                is IdentityUiState.Unauthorized -> TokenEntry(
                    token = tokenInput,
                    message = state.message,
                    onTokenChange = { tokenInput = it },
                    onConnect = { onConnect(tokenInput) },
                )
                is IdentityUiState.Unavailable -> UnavailableState(
                    state = state,
                    token = tokenInput,
                    onTokenChange = { tokenInput = it },
                    onConnect = { onConnect(tokenInput) },
                    onRetry = onRetry,
                    onSwitchIdentity = onSwitchIdentity,
                )
            }
        }
    }
}

@Composable
private fun ProgressState(label: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics { stateDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        CircularProgressIndicator(
            modifier = Modifier
                .size(24.dp)
                .testTag("identity-progress"),
            strokeWidth = 3.dp,
        )
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun TokenEntry(
    token: String,
    message: String?,
    onTokenChange: (String) -> Unit,
    onConnect: () -> Unit,
) {
    Column(
        modifier = Modifier.semantics { stateDescription = "Identity not connected" },
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (message != null) {
            Text(
                text = message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        OutlinedTextField(
            value = token,
            onValueChange = onTokenChange,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("identity-token"),
            label = { Text("Bootstrap token") },
            supportingText = { Text("Use the token provided by your LifeOS server.") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (token.isNotBlank()) onConnect() }),
        )
        Button(
            onClick = onConnect,
            enabled = token.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Connect")
        }
    }
}

@Composable
private fun ConnectedState(profile: IdentityProfile, onSwitchIdentity: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        IdentityDetails(profile, verified = true)
        OutlinedButton(
            onClick = onSwitchIdentity,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Switch identity")
        }
    }
}

@Composable
private fun UnavailableState(
    state: IdentityUiState.Unavailable,
    token: String,
    onTokenChange: (String) -> Unit,
    onConnect: () -> Unit,
    onRetry: () -> Unit,
    onSwitchIdentity: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "LifeOS is unavailable. Check the connection and try again.",
            color = MaterialTheme.colorScheme.error,
        )
        if (state.cachedProfile != null) {
            IdentityDetails(state.cachedProfile, verified = false)
            Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                Text("Retry")
            }
            OutlinedButton(onClick = onSwitchIdentity, modifier = Modifier.fillMaxWidth()) {
                Text("Switch identity")
            }
        } else {
            TokenEntry(
                token = token,
                message = null,
                onTokenChange = onTokenChange,
                onConnect = onConnect,
            )
            OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                Text("Retry previous token")
            }
        }
    }
}

@Composable
private fun IdentityDetails(profile: IdentityProfile, verified: Boolean) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .semantics {
                stateDescription = if (verified) "Identity connected" else "Identity verification unavailable"
            },
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = if (verified) "CONNECTED" else "SAVED IDENTITY",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = profile.displayName,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "ID",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = profile.id,
                maxLines = 1,
                softWrap = false,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 10.sp,
                    letterSpacing = 0.sp,
                ),
            )
            Text("Alias: ${profile.alias}", style = MaterialTheme.typography.bodyMedium)
            Text("Timezone: ${profile.timezone}", style = MaterialTheme.typography.bodyMedium)
            if (!verified) {
                Spacer(modifier = Modifier.size(2.dp))
                Text(
                    text = "Saved locally; not verified in this session.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun LifeOSTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = Typography(),
        content = content,
    )
}
