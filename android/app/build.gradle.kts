import java.net.URI
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

fun normalizeApiBaseUrl(rawValue: String, allowCleartext: Boolean): String {
    val value = rawValue.trim()
    val uri = try {
        URI(value)
    } catch (error: Exception) {
        throw GradleException("API base URL is invalid.", error)
    }
    val scheme = uri.scheme?.lowercase()
    if (scheme !in setOf("http", "https") || uri.host.isNullOrBlank()) {
        throw GradleException("API base URL requires an HTTP(S) scheme and host.")
    }
    if (!allowCleartext && scheme != "https") {
        throw GradleException("Release API base URL must use HTTPS.")
    }
    if (uri.userInfo != null || uri.query != null || uri.fragment != null) {
        throw GradleException("API base URL cannot contain credentials, query, or fragment.")
    }
    val normalized = uri.normalize().toASCIIString()
    return if (normalized.endsWith('/')) normalized else "$normalized/"
}

fun String.asBuildConfigString(): String =
    "\"" + replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val debugApiBaseUrl = normalizeApiBaseUrl(
    providers.gradleProperty("LIFEOS_API_BASE_URL")
        .getOrElse("http://10.0.2.2:8000/api/v1/"),
    allowCleartext = true,
)
val releaseApiBaseUrl = normalizeApiBaseUrl(
    providers.gradleProperty("LIFEOS_RELEASE_API_BASE_URL")
        .getOrElse("https://api.invalid/api/v1/"),
    allowCleartext = false,
)

android {
    namespace = "com.bpn0416.lifeos"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "com.bpn0416.lifeos"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", debugApiBaseUrl.asBuildConfigString())
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", releaseApiBaseUrl.asBuildConfigString())
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.ui:ui:1.10.6")
    implementation("androidx.compose.ui:ui-tooling-preview:1.10.6")
    implementation("androidx.compose.foundation:foundation:1.10.6")
    implementation("androidx.compose.material3:material3:1.4.0")

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:1.10.6")
    debugImplementation("androidx.compose.ui:ui-tooling:1.10.6")
    debugImplementation("androidx.compose.ui:ui-test-manifest:1.10.6")
}
