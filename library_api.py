from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging
import uuid

# -----------------------------
# APP SETUP
# -----------------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# -----------------------------
# TEMP DATABASE (NO MONGODB)
# -----------------------------
USERS_DB = {}
BOOKS_DB = {}

# -----------------------------
# SECURITY
# -----------------------------
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
SECRET_KEY = "mysupersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# -----------------------------
# MODELS
# -----------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class User(BaseModel):
    email: EmailStr
    name: str
    role: Literal["user", "admin"] = "user"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Book(BaseModel):
    book_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    author: str
    category: str
    description: Optional[str] = None
    borrow_policy: Literal["standard", "timed", "daily_return"] = "standard"
    expiry_hours: Optional[int] = None
    is_borrowed: bool = False
    borrowed_by: Optional[str] = None
    borrowed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# -----------------------------
# HELPERS
# -----------------------------
def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = USERS_DB.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# -----------------------------
# ROUTES
# -----------------------------
# 1️⃣ Register
@api_router.post("/register")
def register(user: UserCreate):
    if user.email in USERS_DB:
        raise HTTPException(status_code=400, detail="User already exists")

    USERS_DB[user.email] = {
        "email": user.email,
        "name": user.name,
        "password": get_password_hash(user.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    return {"message": "User registered successfully"}

# 2️⃣ Login
@api_router.post("/login", response_model=Token)
def login(email: EmailStr, password: str):
    user = USERS_DB.get(email)
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": User(**user),
    }

# 3️⃣ Get all books
@api_router.get("/books", response_model=List[Book])
def get_books():
    return list(BOOKS_DB.values())

# 4️⃣ Admin: Add a book
@api_router.post("/books", response_model=Book)
def add_book(book: Book, admin: User = Depends(get_admin_user)):
    BOOKS_DB[book.book_id] = book.dict()
    return book

# 5️⃣ Borrow a book
@api_router.post("/books/borrow/{book_id}")
def borrow_book(book_id: str, user: User = Depends(get_current_user)):
    book = BOOKS_DB.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book["is_borrowed"]:
        raise HTTPException(status_code=400, detail="Book already borrowed")

    book["is_borrowed"] = True
    book["borrowed_by"] = user.email
    book["borrowed_at"] = datetime.now(timezone.utc)
    BOOKS_DB[book_id] = book
    return {"message": f"{book['title']} borrowed successfully"}

# 6️⃣ Return a book
@api_router.post("/books/return/{book_id}")
def return_book(book_id: str, user: User = Depends(get_current_user)):
    book = BOOKS_DB.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book["is_borrowed"] or book["borrowed_by"] != user.email:
        raise HTTPException(status_code=400, detail="You cannot return this book")

    book["is_borrowed"] = False
    book["borrowed_by"] = None
    book["borrowed_at"] = None
    BOOKS_DB[book_id] = book
    return {"message": f"{book['title']} returned successfully"}

# -----------------------------
# ROOT
# -----------------------------
from pydantic import BaseModel

class StatusResponse(BaseModel):
    status: str

@app.get("/", response_model=StatusResponse)
def root():
    return {"status": "Library API running ✅"}


# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# STARTUP
# -----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
@app.on_event("startup")
async def startup_event():
    # Create admin if not exists
    if "admin@library.com" not in USERS_DB:
        USERS_DB["admin@library.com"] = {
            "email": "admin@library.com",
            "name": "Admin",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        }
        logger.info("Admin created: admin@library.com / admin123")

    # Preload sample books
    sample_books = [
        {
            "book_id": "1",
            "title": "Clean Code",
            "author": "Robert Martin",
            "category": "Programming",
            "description": "A Handbook of Agile Software Craftsmanship",
            "borrow_policy": "standard",
        },
        {
            "book_id": "2",
            "title": "Introduction to Algorithms",
            "author": "Cormen",
            "category": "Programming",
            "description": "Comprehensive algorithms textbook",
            "borrow_policy": "standard",
        },
        {
            "book_id": "3",
            "title": "Python Crash Course",
            "author": "Eric Matthes",
            "category": "Programming",
            "description": "Hands-on Python project-based guide",
            "borrow_policy": "daily_return",
            "expiry_hours": 24
        },
        {
            "book_id": "4",
            "title": "The Pragmatic Programmer",
            "author": "Andrew Hunt",
            "category": "Programming",
            "description": "Journey to Mastery",
            "borrow_policy": "standard",
        },
        {
            "book_id": "5",
            "title": "Design Patterns",
            "author": "Gamma, Helm, Johnson, Vlissides",
            "category": "Programming",
            "description": "Elements of Reusable Object-Oriented Software",
            "borrow_policy": "timed",
            "expiry_hours": 72
        },
    ]

    for book in sample_books:
        BOOKS_DB[book["book_id"]] = {**book, "is_borrowed": False, "borrowed_by": None, "borrowed_at": None, "created_at": datetime.now(timezone.utc)}

    logger.info(f"{len(sample_books)} sample books added to BOOKS_DB")

    scheduler.start()
    logger.info("Scheduler started")
