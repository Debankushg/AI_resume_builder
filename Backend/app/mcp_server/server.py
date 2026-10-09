"""MCP server exposing resume-editing tools over stdio.

Run standalone with:  python -m app.mcp_server.server
Every tool takes a session_id so one server can serve many users.
"""
from mcp.server.fastmcp import FastMCP

from app.schemas.resume import Education, Experience, Project
from app.services.resume_store import load_resume, save_resume

mcp = FastMCP("resume-tools")

SECTIONS = {"skills", "experience", "projects", "education"}


@mcp.tool()
def get_resume(session_id: str) -> dict:
    """Return the current resume data."""
    return load_resume(session_id).model_dump()


@mcp.tool()
def update_personal_info(
    session_id: str,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    location: str | None = None,
    summary: str | None = None,
) -> dict:
    """Set or change personal details and the professional summary. Only provided fields change."""
    r = load_resume(session_id)
    for field, value in dict(name=name, email=email, phone=phone, location=location, summary=summary).items():
        if value is not None:
            setattr(r, field, value)
    save_resume(session_id, r)
    return r.model_dump()


@mcp.tool()
def add_skills(session_id: str, skills: list[str]) -> dict:
    """Add skills (duplicates are ignored)."""
    r = load_resume(session_id)
    existing = {s.lower() for s in r.skills}
    for s in skills:
        if s.strip() and s.strip().lower() not in existing:
            r.skills.append(s.strip())
            existing.add(s.strip().lower())
    save_resume(session_id, r)
    return r.model_dump()


@mcp.tool()
def add_experience(
    session_id: str, company: str, role: str,
    start_date: str = "", end_date: str = "", description: str = "",
) -> dict:
    """Add a work experience entry."""
    r = load_resume(session_id)
    r.experience.append(Experience(company=company, role=role, start_date=start_date,
                                   end_date=end_date, description=description))
    save_resume(session_id, r)
    return r.model_dump()


@mcp.tool()
def add_project(
    session_id: str, name: str, description: str = "",
    technologies: list[str] | None = None, link: str = "",
) -> dict:
    """Add a project entry."""
    r = load_resume(session_id)
    r.projects.append(Project(name=name, description=description,
                              technologies=technologies or [], link=link))
    save_resume(session_id, r)
    return r.model_dump()


@mcp.tool()
def add_education(
    session_id: str, institution: str, degree: str,
    start_year: str = "", end_year: str = "",
) -> dict:
    """Add a qualification / education entry."""
    r = load_resume(session_id)
    r.education.append(Education(institution=institution, degree=degree,
                                 start_year=start_year, end_year=end_year))
    save_resume(session_id, r)
    return r.model_dump()


@mcp.tool()
def remove_item(session_id: str, section: str, index: int) -> dict:
    """Remove the item at a 0-based index from skills, experience, projects or education."""
    if section not in SECTIONS:
        return {"error": f"section must be one of {sorted(SECTIONS)}"}
    r = load_resume(session_id)
    items = getattr(r, section)
    if not 0 <= index < len(items):
        return {"error": f"index out of range (0..{len(items) - 1})"}
    items.pop(index)
    save_resume(session_id, r)
    return r.model_dump()


if __name__ == "__main__":
    mcp.run(transport="stdio")
