package com.bpn0416.lifeos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ApiBaseUrlTest {
    @Test
    fun normalizesWhitespaceAndTrailingSlash() {
        assertEquals(
            "http://10.0.2.2:8000/api/v1/",
            ApiBaseUrl.normalize("  http://10.0.2.2:8000/api/v1  ", allowCleartext = true),
        )
    }

    @Test
    fun acceptsHttpsForRelease() {
        assertEquals(
            "https://example.test/api/v1/",
            ApiBaseUrl.normalize("https://example.test/api/v1/", allowCleartext = false),
        )
    }

    @Test
    fun rejectsInvalidOrUnsafeValues() {
        listOf(
            "10.0.2.2:8000/api/v1/",
            "ftp://example.test/api/v1/",
            "https://user:password@example.test/api/v1/",
            "https://example.test/api/v1/?token=value",
            "https://example.test/api/v1/#fragment",
        ).forEach { value ->
            assertThrows(IllegalArgumentException::class.java) {
                ApiBaseUrl.normalize(value, allowCleartext = true)
            }
        }
    }

    @Test
    fun rejectsCleartextForRelease() {
        assertThrows(IllegalArgumentException::class.java) {
            ApiBaseUrl.normalize("http://example.test/api/v1/", allowCleartext = false)
        }
    }
}
