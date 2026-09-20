package com.bpn0416.lifeos

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LifeOSAppTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun freshStateRequiresNonblankTokenAndSubmitsTrimmedInput() {
        var submitted: String? = null
        composeRule.setContent {
            LifeOSApp(
                identityState = IdentityUiState.Disconnected(),
                onConnect = { submitted = it.trim() },
                onRetry = {},
                onSwitchIdentity = {},
            )
        }

        composeRule.onNodeWithContentDescription("LifeOS application").assertIsDisplayed()
        composeRule.onNodeWithText("Connect").assertIsNotEnabled()
        composeRule.onNodeWithTag("identity-token").performTextInput("  fixture-token  ")
        composeRule.onNodeWithText("Connect").assertIsEnabled().performScrollTo().performClick()

        assertEquals("fixture-token", submitted)
    }

    @Test
    fun connectedAndUnavailableStatesExposeSafeActionsWithoutToken() {
        var state: IdentityUiState by mutableStateOf(IdentityUiState.Connected(profile))
        composeRule.setContent {
            LifeOSApp(
                identityState = state,
                onConnect = {},
                onRetry = {},
                onSwitchIdentity = {},
            )
        }
        composeRule.onNodeWithText("Me").assertIsDisplayed()
        composeRule.onNodeWithText("Switch identity").assertIsDisplayed()
        composeRule.onAllNodesWithText("fixture-token").assertCountEquals(0)

        composeRule.runOnIdle {
            state = IdentityUiState.Unavailable(profile, hasSavedSession = true)
        }
        composeRule.onNodeWithText("Retry").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Saved locally; not verified in this session.").assertIsDisplayed()
    }

    @Test
    fun loadingAndUnauthorizedStatesAreAccessible() {
        var state: IdentityUiState by mutableStateOf(IdentityUiState.Loading)
        composeRule.setContent {
            LifeOSApp(
                identityState = state,
                onConnect = {},
                onRetry = {},
                onSwitchIdentity = {},
            )
        }
        composeRule.onNodeWithTag("identity-progress").assertIsDisplayed()

        composeRule.runOnIdle {
            state = IdentityUiState.Unauthorized()
        }
        composeRule.onNodeWithText("That token is no longer valid.").assertIsDisplayed()
        composeRule.onNodeWithTag("identity-token").assertIsDisplayed()
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
