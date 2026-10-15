from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import now_server
from app.models.project import Project
from app.models.project_todo_link import ProjectTodoLink
from app.models.todo import Todo
from app.schemas.project_todo_link import LinkedTodoRead, ProjectTodoLinksPut


def link_rows(db: Session, project_id: UUID) -> list[ProjectTodoLink]:
    return list(db.execute(
        select(ProjectTodoLink).where(ProjectTodoLink.project_id == project_id)
        .order_by(ProjectTodoLink.sort_order, ProjectTodoLink.todo_id)
    ).scalars())


def collection_data(db: Session, project: Project) -> dict:
    links = link_rows(db, project.id)
    todos = {
        todo.id: todo for todo in db.execute(select(Todo).where(
            Todo.id.in_([link.todo_id for link in links]),
            Todo.user_id == project.user_id, Todo.deleted_at.is_(None),
        )).scalars()
    } if links else {}
    return {
        "links": [
            {
                "todo_id": str(link.todo_id), "sort_order": link.sort_order,
                "unavailable": link.todo_id not in todos,
                "todo": LinkedTodoRead.model_validate(todos[link.todo_id]).model_dump(mode="json") if link.todo_id in todos else None,
            }
            for link in links
        ],
        "project_version": project.version,
    }


def replace_links(db: Session, project: Project, payload: ProjectTodoLinksPut) -> dict:
    ids = payload.todo_ids
    if len(ids) != len(set(ids)):
        raise ApiError(400, "validation_error", "Todo IDs must be unique")
    existing = link_rows(db, project.id)
    retained = {link.todo_id: link for link in existing}
    # Match source updates/deletion on the row lock, always acquiring multiple sources in UUID order.
    owned = {
        todo.id: todo for todo in db.execute(
            select(Todo).where(Todo.user_id == project.user_id, Todo.id.in_(ids))
            .order_by(Todo.id).with_for_update()
        ).scalars()
    } if ids else {}
    if any(todo_id not in retained and (todo_id not in owned or owned[todo_id].deleted_at is not None) for todo_id in ids):
        raise ApiError(400, "validation_error", "Todo cannot be linked")

    if [link.todo_id for link in existing] != ids:
        for link in existing:
            if link.todo_id not in ids:
                db.delete(link)
        for position, todo_id in enumerate(ids):
            if todo_id in retained:
                retained[todo_id].sort_order = position
            else:
                db.add(ProjectTodoLink(user_id=project.user_id, project_id=project.id, todo_id=todo_id, sort_order=position))
        project.version += 1
        project.updated_at = now_server()
        db.flush()
    return collection_data(db, project)
