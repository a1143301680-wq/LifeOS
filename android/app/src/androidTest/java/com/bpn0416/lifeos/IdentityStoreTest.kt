package com.bpn0416.lifeos

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class IdentityStoreTest {
    private lateinit var context: Context
    private lateinit var scope: CoroutineScope
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var store: PreferencesIdentityStore
    private val storeName = "identity-test-${UUID.randomUUID()}"

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        dataStore = PreferenceDataStoreFactory.create(
            scope = scope,
            produceFile = { context.preferencesDataStoreFile(storeName) },
        )
        store = PreferencesIdentityStore(dataStore)
    }

    @After
    fun tearDown() {
        scope.cancel()
        context.preferencesDataStoreFile(storeName).delete()
    }

    @Test
    fun savesCompleteSessionAndClearsAtomically() = runBlocking {
        val session = IdentitySession("fixture-token", profile)

        store.save(session)
        assertEquals(session, store.load())

        store.clear()
        assertNull(store.load())
    }

    @Test
    fun partialSessionFailsClosedAndIsRemoved() = runBlocking {
        dataStore.edit { preferences ->
            preferences[PreferencesIdentityStore.TOKEN] = "partial-fixture"
            preferences[PreferencesIdentityStore.ALIAS] = "me"
        }

        assertNull(store.load())
        assertNull(store.load())
    }

    @Test
    fun completeSessionWithInvalidMetadataFailsClosed() = runBlocking {
        dataStore.edit { preferences ->
            preferences[PreferencesIdentityStore.TOKEN] = "invalid-fixture"
            preferences[PreferencesIdentityStore.USER_ID] = "not-a-uuid"
            preferences[PreferencesIdentityStore.ALIAS] = "me"
            preferences[PreferencesIdentityStore.DISPLAY_NAME] = "Me"
            preferences[PreferencesIdentityStore.TIMEZONE] = "Asia/Shanghai"
        }

        assertNull(store.load())
        assertNull(store.load())
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
