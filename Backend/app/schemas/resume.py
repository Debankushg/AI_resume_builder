from pydantic import BaseModel, Field


class Experience(BaseModel):
    company: str
    role: str
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class Project(BaseModel):
    name: str
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    link: str = ""


class Education(BaseModel):
    institution: str
    degree: str
    start_year: str = ""
    end_year: str = ""


class ResumeData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    resume: ResumeData
