package com.bpn0416.lifeos

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first

private val Context.identityDataStore by preferencesDataStore(
    name = "identity_session",
    corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
)

interface IdentityStore {
    suspend fun load(): IdentitySession?

    suspend fun save(session: IdentitySession)

    suspend fun clear()
}

class PreferencesIdentityStore(
    private val dataStore: DataStore<Preferences>,
) : IdentityStore {
    constructor(context: Context) : this(context.identityDataStore)

    override suspend fun load(): IdentitySession? {
        val preferences = try {
            dataStore.data.first()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            return null
        }

        val values = listOf(
            preferences[TOKEN],
            preferences[USER_ID],
            preferences[ALIAS],
            preferences[DISPLAY_NAME],
            preferences[TIMEZONE],
        )
        if (values.all { it == null }) return null

        val session = IdentitySession(
            token = values[0].orEmpty(),
            profile = IdentityProfile(
                id = values[1].orEmpty(),
                alias = values[2].orEmpty(),
                displayName = values[3].orEmpty(),
                timezone = values[4].orEmpty(),
            ),
        )
        if (session.isValid()) return session

        clear()
        return null
    }

    override suspend fun save(session: IdentitySession) {
        require(session.isValid()) { "Identity session is incomplete." }
        dataStore.edit { preferences ->
            preferences.clear()
            preferences[TOKEN] = session.token
            preferences[USER_ID] = session.profile.id
            preferences[ALIAS] = session.profile.alias
            preferences[DISPLAY_NAME] = session.profile.displayName
            preferences[TIMEZONE] = session.profile.timezone
        }
    }

    override suspend fun clear() {
        dataStore.edit { it.clear() }
    }

    companion object {
        internal val TOKEN = stringPreferencesKey("token")
        internal val USER_ID = stringPreferencesKey("user_id")
        internal val ALIAS = stringPreferencesKey("alias")
        internal val DISPLAY_NAME = stringPreferencesKey("display_name")
        internal val TIMEZONE = stringPreferencesKey("timezone")
    }
}
