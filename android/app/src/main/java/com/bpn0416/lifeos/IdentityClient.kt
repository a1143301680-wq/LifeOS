package com.bpn0416.lifeos

import java.net.URI
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

interface IdentityClient {
    suspend fun getMe(token: String): IdentityResult
}

class OkHttpIdentityClient(
    baseUrl: String,
    private val httpClient: OkHttpClient = defaultHttpClient(),
) : IdentityClient {
    private val meUrl = URI(baseUrl).resolve("me").toASCIIString()

    override suspend fun getMe(token: String): IdentityResult {
        val request = Request.Builder()
            .url(meUrl)
            .get()
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .build()

        return suspendCancellableCoroutine { continuation ->
            val call = httpClient.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(
                object : Callback {
                    override fun onFailure(call: Call, e: java.io.IOException) {
                        if (continuation.isActive) {
                            continuation.resume(IdentityResult.Recoverable)
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        val result = try {
                            response.use { parseResponse(it) }
                        } catch (_: Exception) {
                            IdentityResult.Recoverable
                        }
                        if (continuation.isActive) {
                            continuation.resume(result)
                        }
                    }
                },
            )
        }
    }

    private fun parseResponse(response: Response): IdentityResult {
        val body = response.body.string()
        return when (response.code) {
            200 -> IdentityEnvelopeParser.parseSuccess(body)
                ?.let(IdentityResult::Success)
                ?: IdentityResult.Recoverable

            401 -> {
                IdentityEnvelopeParser.isDocumentedError(body, expectedCode = "unauthorized")
                IdentityResult.Unauthorized
            }

            else -> {
                IdentityEnvelopeParser.isDocumentedError(body)
                IdentityResult.Recoverable
            }
        }
    }

    companion object {
        private fun defaultHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
