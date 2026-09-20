package com.bpn0416.lifeos

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class IdentityApiClientTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun getMeUsesBearerHeaderOnlyAndParsesStrictSuccessEnvelope() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(validEnvelope()),
        )
        val client = OkHttpIdentityClient(server.url("api/v1/").toString())

        val result = client.getMe("test-token-value")
        val request = server.takeRequest()

        assertTrue(result is IdentityResult.Success)
        assertEquals("/api/v1/me", request.path)
        assertEquals("Bearer test-token-value", request.getHeader("Authorization"))
        assertEquals("application/json", request.getHeader("Accept"))
        assertEquals(0L, request.bodySize)
        assertFalse(request.requestUrl!!.queryParameterNames.contains("user_id"))
        assertFalse(request.requestUrl.toString().contains("test-token-value"))
    }

    @Test
    fun malformedSuccessIsRecoverableAndDoesNotEchoPayload() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"data":{"id":"bad"}}"""))
        val client = OkHttpIdentityClient(server.url("api/v1/").toString())

        val result = client.getMe("fixture-token")

        assertEquals(IdentityResult.Recoverable, result)
        assertFalse(result.toString().contains("fixture-token"))
    }

    @Test
    fun unauthorizedAndServerFailureAreClassifiedWithoutServerDetails() = runBlocking {
        server.enqueue(
            MockResponse().setResponseCode(401).setBody(
                """{"error":{"code":"unauthorized","message":"rejected","details":{}},"server_time":"2026-09-15T10:00:00+08:00"}""",
            ),
        )
        server.enqueue(
            MockResponse().setResponseCode(503).setBody(
                """{"error":{"code":"internal_error","message":"do not expose","details":{}},"server_time":"2026-09-15T10:00:00+08:00"}""",
            ),
        )
        val client = OkHttpIdentityClient(server.url("api/v1/").toString())

        assertEquals(IdentityResult.Unauthorized, client.getMe("first-fixture"))
        assertEquals(IdentityResult.Recoverable, client.getMe("second-fixture"))
    }

    @Test
    fun connectionFailureIsRecoverable() = runBlocking {
        val closedServer = MockWebServer()
        closedServer.start()
        val baseUrl = closedServer.url("api/v1/").toString()
        closedServer.shutdown()

        assertEquals(
            IdentityResult.Recoverable,
            OkHttpIdentityClient(baseUrl).getMe("connection-fixture"),
        )
    }

    @Test
    fun callTimeoutIsRecoverable() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(validEnvelope())
                .setBodyDelay(1, TimeUnit.SECONDS),
        )
        val shortTimeoutClient = OkHttpClient.Builder()
            .callTimeout(100, TimeUnit.MILLISECONDS)
            .build()

        assertEquals(
            IdentityResult.Recoverable,
            OkHttpIdentityClient(server.url("api/v1/").toString(), shortTimeoutClient)
                .getMe("timeout-fixture"),
        )
    }

    private fun validEnvelope() = """
        {
          "data": {
            "id": "6f4a5620-8f67-4f15-bc2a-4e443fc8071c",
            "alias": "me",
            "display_name": "Me",
            "timezone": "Asia/Shanghai"
          },
          "server_time": "2026-09-15T10:00:00+08:00"
        }
    """.trimIndent()
}
