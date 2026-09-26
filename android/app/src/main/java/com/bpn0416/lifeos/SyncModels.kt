package com.bpn0416.lifeos

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

sealed interface SyncChange {
    val cursor: Long

    data class TodoUpsert(override val cursor: Long, val todo: CachedTodo) : SyncChange
    data class TodoDelete(override val cursor: Long, val entityId: String) : SyncChange
    data class CategoryUpsert(override val cursor: Long, val category: CachedTodoCategory) : SyncChange
    data class CategoryDelete(override val cursor: Long, val entityId: String) : SyncChange
}

data class SyncPage(
    val requestedCursor: Long,
    val changes: List<SyncChange>,
    val nextCursor: Long,
    val hasMore: Boolean,
)

sealed interface SyncPageParseResult {
    data class Success(val page: SyncPage) : SyncPageParseResult
    data object Invalid : SyncPageParseResult
}

object SyncPageParser {
    private val json = Json { explicitNulls = true }
    private val envelopeKeys = setOf("items", "next_cursor", "has_more", "server_time")
    private val itemBaseKeys = setOf("cursor", "change_type", "entity_type", "entity_id", "entity_version")
    private val todoSnapshotKeys = setOf(
        "id", "category_id", "category", "title", "note", "status", "priority", "planned_date",
        "due_at", "completed_at", "version", "created_at", "updated_at",
    )
    private val categorySnapshotKeys = setOf(
        "id", "name", "color", "icon", "is_inbox", "sort_order", "created_at", "updated_at",
    )

    fun parse(body: String, requestedCursor: Long): SyncPageParseResult = runCatching {
        require(requestedCursor >= 0)
        val root = json.parseToJsonElement(body).jsonObject
        require(root.keys == envelopeKeys)
        requireTimestamp(root.requiredString("server_time"))
        val nextCursor = root.requiredLong("next_cursor").also { require(it >= requestedCursor) }
        val hasMore = root.requiredBoolean("has_more")
        val items = root["items"]?.jsonArray ?: error("items required")
        val changes = parseChanges(items, requestedCursor)
        val lastCursor = changes.lastOrNull()?.cursor
        require(lastCursor == null || lastCursor <= nextCursor)
        if (hasMore) {
            require(lastCursor != null && nextCursor == lastCursor && nextCursor > requestedCursor)
        }
        SyncPageParseResult.Success(SyncPage(requestedCursor, changes, nextCursor, hasMore))
    }.getOrElse { SyncPageParseResult.Invalid }

    private fun parseChanges(items: JsonArray, requestedCursor: Long): List<SyncChange> {
        var previous = requestedCursor
        return items.map { element ->
            val item = element.jsonObject
            val cursor = item.requiredLong("cursor")
            require(cursor > previous)
            previous = cursor
            parseChange(item, cursor)
        }
    }

    private fun parseChange(item: JsonObject, cursor: Long): SyncChange {
        val entityType = item.requiredString("entity_type")
        val changeType = item.requiredString("change_type")
        val entityId = item.requiredUuid("entity_id")
        return when (entityType) {
            "todo" -> parseTodo(item, cursor, changeType, entityId)
            "todo_category" -> parseCategory(item, cursor, changeType, entityId)
            else -> error("unsupported entity")
        }
    }

    private fun parseTodo(item: JsonObject, cursor: Long, changeType: String, entityId: String): SyncChange {
        val version = item.requiredInt("entity_version").also { require(it > 0) }
        return if (changeType == "todo.deleted") {
            require(item.keys == itemBaseKeys + setOf("deleted", "deleted_at"))
            require(item.requiredBoolean("deleted"))
            requireTimestamp(item.requiredString("deleted_at"))
            SyncChange.TodoDelete(cursor, entityId)
        } else {
            require(changeType in setOf("todo.created", "todo.updated", "todo.completed", "todo.reopened"))
            require(item.keys == itemBaseKeys + "snapshot")
            val snapshot = item["snapshot"]?.jsonObject ?: error("snapshot required")
            require(snapshot.keys == todoSnapshotKeys)
            require(snapshot.requiredUuid("id") == entityId)
            require(snapshot.requiredInt("version") == version)
            SyncChange.TodoUpsert(cursor, snapshot.toTodo(cursor))
        }
    }

    private fun parseCategory(item: JsonObject, cursor: Long, changeType: String, entityId: String): SyncChange {
        require(item["entity_version"] == JsonNull)
        return if (changeType == "category.deleted") {
            require(item.keys == itemBaseKeys + setOf("deleted", "deleted_at"))
            require(item.requiredBoolean("deleted"))
            requireTimestamp(item.requiredString("deleted_at"))
            SyncChange.CategoryDelete(cursor, entityId)
        } else {
            require(changeType in setOf("category.created", "category.updated"))
            require(item.keys == itemBaseKeys + "snapshot")
            val snapshot = item["snapshot"]?.jsonObject ?: error("snapshot required")
            require(snapshot.keys == categorySnapshotKeys)
            require(snapshot.requiredUuid("id") == entityId)
            SyncChange.CategoryUpsert(cursor, snapshot.toCategory(cursor))
        }
    }

    private fun JsonObject.toTodo(cursor: Long): CachedTodo {
        val category = nullableObject("category")
        if (category != null) {
            require(category.keys == setOf("id", "name", "is_deleted"))
        }
        val categoryId = nullableUuid("category_id")
        require((category == null && categoryId == null) || category?.requiredUuid("id") == categoryId)
        nullableDate("planned_date")
        nullableTimestamp("due_at")
        nullableTimestamp("completed_at")
        val createdAt = requiredString("created_at").also(::requireTimestamp)
        val updatedAt = requiredString("updated_at").also(::requireTimestamp)
        val status = requiredString("status").also { require(it in setOf("pending", "completed", "canceled")) }
        val priority = requiredString("priority").also { require(it in setOf("high", "medium", "low")) }
        return CachedTodo(
            ownerId = "",
            entityId = requiredUuid("id"),
            categoryId = categoryId,
            categoryName = category?.requiredString("name"),
            categoryIsDeleted = category?.requiredBoolean("is_deleted"),
            title = requiredString("title").also { require(it.isNotBlank()) },
            note = nullableString("note"),
            status = status,
            priority = priority,
            plannedDate = nullableString("planned_date"),
            dueAt = nullableString("due_at"),
            completedAt = nullableString("completed_at"),
            version = requiredInt("version"),
            createdAt = createdAt,
            updatedAt = updatedAt,
            lastSyncCursor = cursor,
        )
    }

    private fun JsonObject.toCategory(cursor: Long): CachedTodoCategory {
        val createdAt = requiredString("created_at").also(::requireTimestamp)
        val updatedAt = requiredString("updated_at").also(::requireTimestamp)
        return CachedTodoCategory(
            ownerId = "",
            entityId = requiredUuid("id"),
            name = requiredString("name").also { require(it.isNotBlank()) },
            color = nullableString("color"),
            icon = nullableString("icon"),
            isInbox = requiredBoolean("is_inbox"),
            sortOrder = requiredInt("sort_order"),
            createdAt = createdAt,
            updatedAt = updatedAt,
            lastSyncCursor = cursor,
        )
    }

    private fun requireTimestamp(value: String) { OffsetDateTime.parse(value) }
    private fun JsonObject.nullableTimestamp(key: String) { nullableString(key)?.let(::requireTimestamp) }
    private fun JsonObject.nullableDate(key: String) { nullableString(key)?.let(LocalDate::parse) }
    private fun JsonObject.requiredString(key: String): String {
        val primitive = this[key]?.jsonPrimitive ?: error("$key required")
        require(primitive.isString)
        return primitive.content
    }
    private fun JsonObject.nullableString(key: String): String? = nullable(key)?.jsonPrimitive?.let {
        require(it.isString)
        it.content
    }
    private fun JsonObject.requiredLong(key: String) = this[key]?.jsonPrimitive?.longOrNull ?: error("$key required")
    private fun JsonObject.requiredInt(key: String) = this[key]?.jsonPrimitive?.intOrNull ?: error("$key required")
    private fun JsonObject.requiredBoolean(key: String) = this[key]?.jsonPrimitive?.booleanOrNull ?: error("$key required")
    private fun JsonObject.requiredUuid(key: String) = requiredString(key).also { UUID.fromString(it) }
    private fun JsonObject.nullableUuid(key: String) = nullableString(key)?.also { UUID.fromString(it) }
    private fun JsonObject.nullableObject(key: String): JsonObject? = nullable(key)?.jsonObject
    private fun JsonObject.nullable(key: String): JsonElement? = this[key]?.takeUnless { it == JsonNull }
}
