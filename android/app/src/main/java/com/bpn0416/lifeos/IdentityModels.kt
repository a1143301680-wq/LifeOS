package com.bpn0416.lifeos

import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

data class IdentityProfile(
    val id: String,
    val alias: String,
    val displayName: String,
    val timezone: String,
) {
    fun isValid(): Boolean =
        runCatching { UUID.fromString(id) }.isSuccess &&
            alias.isNotBlank() &&
            displayName.isNotBlank() &&
            timezone.isNotBlank()
}

data class IdentitySession(
    val token: String,
    val profile: IdentityProfile,
) {
    fun isValid(): Boolean = token.isNotBlank() && profile.isValid()
}

sealed interface IdentityResult {
    data class Success(val profile: IdentityProfile) : IdentityResult

    data object Unauthorized : IdentityResult

    data object Recoverable : IdentityResult
}

internal object IdentityEnvelopeParser {
    private val json = Json {
        ignoreUnknownKeys = false
        explicitNulls = true
    }

    fun parseSuccess(body: String): IdentityProfile? = runCatching {
        val envelope = json.decodeFromString<IdentityEnvelope>(body)
        requireValidServerTime(envelope.serverTime)
        IdentityProfile(
            id = envelope.data.id,
            alias = envelope.data.alias,
            displayName = envelope.data.displayName,
            timezone = envelope.data.timezone,
        ).also { require(it.isValid()) }
    }.getOrNull()

    fun isDocumentedError(body: String, expectedCode: String? = null): Boolean = runCatching {
        val envelope = json.decodeFromString<ErrorEnvelope>(body)
        requireValidServerTime(envelope.serverTime)
        require(envelope.error.code.isNotBlank())
        require(envelope.error.message.isNotBlank())
        expectedCode == null || envelope.error.code == expectedCode
    }.getOrDefault(false)

    private fun requireValidServerTime(value: String) {
        OffsetDateTime.parse(value)
    }
}

@Serializable
private data class IdentityEnvelope(
    val data: IdentityData,
    @SerialName("server_time") val serverTime: String,
)

@Serializable
private data class IdentityData(
    val id: String,
    val alias: String,
    @SerialName("display_name") val displayName: String,
    val timezone: String,
)

@Serializable
private data class ErrorEnvelope(
    val error: ErrorData,
    @SerialName("server_time") val serverTime: String,
)

@Serializable
private data class ErrorData(
    val code: String,
    val message: String,
    val details: JsonObject,
)
