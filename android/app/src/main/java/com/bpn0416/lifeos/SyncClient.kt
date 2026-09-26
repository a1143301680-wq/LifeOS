package com.bpn0416.lifeos

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

sealed interface SyncFetchResult {
    data class Page(val page: SyncPage) : SyncFetchResult
    data object Unauthorized : SyncFetchResult
    data object Recoverable : SyncFetchResult
    data object InvalidCursor : SyncFetchResult
    data object InvalidPage : SyncFetchResult
}

interface SyncClient {
    suspend fun fetch(token: String, cursor: Long, limit: Int): SyncFetchResult
}

class OkHttpSyncClient(
    apiBaseUrl: String,
    private val httpClient: OkHttpClient = defaultHttpClient(),
) : SyncClient {
    private val syncUrl = apiBaseUrl.toHttpUrl().resolve("sync/changes")
        ?: error("Sync URL could not be resolved.")

    override suspend fun fetch(token: String, cursor: Long, limit: Int): SyncFetchResult {
        require(token.isNotBlank())
        require(cursor >= 0)
        require(limit in 1..500)
        val url = syncUrl.newBuilder()
            .addQueryParameter("cursor", cursor.toString())
            .addQueryParameter("limit", limit.toString())
            .build()
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        return try {
            execute(request).use { response -> classify(response, cursor) }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            SyncFetchResult.Recoverable
        }
    }

    private suspend fun execute(request: Request): Response = suspendCancellableCoroutine { continuation ->
        val call = httpClient.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWith(Result.failure(e))
            }

            override fun onResponse(call: Call, response: Response) {
                if (continuation.isActive) continuation.resume(response) else response.close()
            }
        })
    }

    private fun classify(response: Response, requestedCursor: Long): SyncFetchResult {
        val body = response.body.string()
        return when (response.code) {
            200 -> when (val parsed = SyncPageParser.parse(body, requestedCursor)) {
                is SyncPageParseResult.Success -> SyncFetchResult.Page(parsed.page)
                SyncPageParseResult.Invalid -> SyncFetchResult.InvalidPage
            }
            401 -> SyncFetchResult.Unauthorized
            400 -> SyncFetchResult.InvalidCursor
            else -> SyncFetchResult.Recoverable
        }
    }

    companion object {
        private fun defaultHttpClient() = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
