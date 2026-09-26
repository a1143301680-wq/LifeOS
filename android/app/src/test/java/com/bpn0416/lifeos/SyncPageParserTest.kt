package com.bpn0416.lifeos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncPageParserTest {
    @Test
    fun parsesTodoAndCategorySnapshotsWithCursorGap() {
        val result = SyncPageParser.parse(page(items = "${todoItem(3)},${categoryItem(7)}", next = 9), 0)

        assertTrue(result is SyncPageParseResult.Success)
        val parsed = (result as SyncPageParseResult.Success).page
        assertEquals(listOf(3L, 7L), parsed.changes.map { it.cursor })
        assertEquals(9L, parsed.nextCursor)
    }

    @Test
    fun acceptsEmptyHighWaterPage() {
        val result = SyncPageParser.parse(page(items = "", next = 14), 9)

        assertEquals(14L, (result as SyncPageParseResult.Success).page.nextCursor)
    }

    @Test
    fun rejectsStaleOutOfOrderUnknownAndNonProgressingPages() {
        val invalid = listOf(
            page(items = todoItem(5), next = 5) to 5L,
            page(items = "${todoItem(4)},${categoryItem(3)}", next = 4) to 0L,
            page(items = todoItem(3).replace("todo.created", "todo.magic"), next = 3) to 0L,
            page(items = "", next = 0, hasMore = true) to 0L,
        )

        invalid.forEach { (body, cursor) ->
            assertTrue(SyncPageParser.parse(body, cursor) is SyncPageParseResult.Invalid)
        }
    }

    @Test
    fun rejectsMismatchedSnapshotWithoutPartialPage() {
        val mismatched = todoItem(2).replaceFirst(TODO_ID, OTHER_ID)
        val result = SyncPageParser.parse(page(items = mismatched, next = 2), 0)

        assertTrue(result is SyncPageParseResult.Invalid)
    }

    @Test
    fun parsesTombstonesAndRejectsVersionOrShapeMismatch() {
        assertTrue(SyncPageParser.parse(page(todoDeleted(2), 2), 0) is SyncPageParseResult.Success)

        val wrongVersion = todoItem(2).replace("\"version\":1", "\"version\":2")
        val extraField = categoryItem(2).replace("\"updated_at\"", "\"unexpected\":1,\"updated_at\"")
        assertTrue(SyncPageParser.parse(page(wrongVersion, 2), 0) is SyncPageParseResult.Invalid)
        assertTrue(SyncPageParser.parse(page(extraField, 2), 0) is SyncPageParseResult.Invalid)
    }

    private fun page(items: String, next: Long, hasMore: Boolean = false) = """
        {"items":[$items],"next_cursor":$next,"has_more":$hasMore,"server_time":"2026-09-26T12:00:00+08:00"}
    """.trimIndent()

    private fun todoItem(cursor: Long) = """
        {"cursor":$cursor,"change_type":"todo.created","entity_type":"todo","entity_id":"$TODO_ID","entity_version":1,"snapshot":{"id":"$TODO_ID","category_id":null,"category":null,"title":"Read contract","note":null,"status":"pending","priority":"medium","planned_date":null,"due_at":null,"completed_at":null,"version":1,"created_at":"2026-09-26T12:00:00+08:00","updated_at":"2026-09-26T12:00:00+08:00"}}
    """.trimIndent()

    private fun categoryItem(cursor: Long) = """
        {"cursor":$cursor,"change_type":"category.created","entity_type":"todo_category","entity_id":"$CATEGORY_ID","entity_version":null,"snapshot":{"id":"$CATEGORY_ID","name":"Work","color":null,"icon":null,"is_inbox":false,"sort_order":1,"created_at":"2026-09-26T12:00:00+08:00","updated_at":"2026-09-26T12:00:00+08:00"}}
    """.trimIndent()

    private fun todoDeleted(cursor: Long) = """
        {"cursor":$cursor,"change_type":"todo.deleted","entity_type":"todo","entity_id":"$TODO_ID","entity_version":2,"deleted":true,"deleted_at":"2026-09-26T12:00:00+08:00"}
    """.trimIndent()

    companion object {
        private const val TODO_ID = "11111111-1111-4111-8111-111111111111"
        private const val OTHER_ID = "22222222-2222-4222-8222-222222222222"
        private const val CATEGORY_ID = "33333333-3333-4333-8333-333333333333"
    }
}
