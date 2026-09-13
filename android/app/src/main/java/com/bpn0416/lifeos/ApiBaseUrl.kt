package com.bpn0416.lifeos

import java.net.URI

object ApiBaseUrl {
    fun normalize(rawValue: String, allowCleartext: Boolean): String {
        val value = rawValue.trim()
        val uri = try {
            URI(value)
        } catch (error: Exception) {
            throw IllegalArgumentException("API base URL is invalid.", error)
        }
        val scheme = uri.scheme?.lowercase()
        require(scheme == "http" || scheme == "https") {
            "API base URL requires an HTTP(S) scheme."
        }
        require(!uri.host.isNullOrBlank()) { "API base URL requires a host." }
        require(allowCleartext || scheme == "https") { "Cleartext API base URL is not allowed." }
        require(uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "API base URL cannot contain credentials, query, or fragment."
        }

        val normalized = uri.normalize().toASCIIString()
        return if (normalized.endsWith('/')) normalized else "$normalized/"
    }
}
