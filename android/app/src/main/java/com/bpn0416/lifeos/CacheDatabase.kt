package com.bpn0416.lifeos

import android.content.Context
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert

@Entity(
    tableName = "cached_todos",
    primaryKeys = ["owner_id", "entity_id"],
    indices = [Index("owner_id"), Index(value = ["owner_id", "category_id"])],
)
data class CachedTodo(
    @ColumnInfo(name = "owner_id") val ownerId: String,
    @ColumnInfo(name = "entity_id") val entityId: String,
    @ColumnInfo(name = "category_id") val categoryId: String?,
    @ColumnInfo(name = "category_name") val categoryName: String?,
    @ColumnInfo(name = "category_is_deleted") val categoryIsDeleted: Boolean?,
    val title: String,
    val note: String?,
    val status: String,
    val priority: String,
    @ColumnInfo(name = "planned_date") val plannedDate: String?,
    @ColumnInfo(name = "due_at") val dueAt: String?,
    @ColumnInfo(name = "completed_at") val completedAt: String?,
    val version: Int,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "last_sync_cursor") val lastSyncCursor: Long,
)

@Entity(
    tableName = "cached_todo_categories",
    primaryKeys = ["owner_id", "entity_id"],
    indices = [Index("owner_id")],
)
data class CachedTodoCategory(
    @ColumnInfo(name = "owner_id") val ownerId: String,
    @ColumnInfo(name = "entity_id") val entityId: String,
    val name: String,
    val color: String?,
    val icon: String?,
    @ColumnInfo(name = "is_inbox") val isInbox: Boolean,
    @ColumnInfo(name = "sort_order") val sortOrder: Int,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "last_sync_cursor") val lastSyncCursor: Long,
)

@Entity(tableName = "sync_state", primaryKeys = ["owner_id"])
data class SyncState(
    @ColumnInfo(name = "owner_id") val ownerId: String,
    val cursor: Long,
)

@Dao
interface CacheDao {
    @Query("SELECT * FROM sync_state WHERE owner_id = :ownerId")
    suspend fun syncState(ownerId: String): SyncState?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putSyncState(state: SyncState)

    @Upsert
    suspend fun upsertTodo(todo: CachedTodo)

    @Upsert
    suspend fun upsertCategory(category: CachedTodoCategory)

    @Query("DELETE FROM cached_todos WHERE owner_id = :ownerId AND entity_id = :entityId")
    suspend fun deleteTodo(ownerId: String, entityId: String): Int

    @Query("DELETE FROM cached_todo_categories WHERE owner_id = :ownerId AND entity_id = :entityId")
    suspend fun deleteCategory(ownerId: String, entityId: String): Int

    @Query("SELECT * FROM cached_todos WHERE owner_id = :ownerId AND entity_id = :entityId")
    suspend fun todo(ownerId: String, entityId: String): CachedTodo?

    @Query("SELECT * FROM cached_todo_categories WHERE owner_id = :ownerId AND entity_id = :entityId")
    suspend fun category(ownerId: String, entityId: String): CachedTodoCategory?
}

@Database(
    entities = [CachedTodo::class, CachedTodoCategory::class, SyncState::class],
    version = 1,
    exportSchema = true,
)
abstract class LifeOSDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao

    companion object {
        private const val DATABASE_NAME = "lifeos.db"

        fun open(context: Context): LifeOSDatabase = Room.databaseBuilder(
            context.applicationContext,
            LifeOSDatabase::class.java,
            DATABASE_NAME,
        ).build()
    }
}
