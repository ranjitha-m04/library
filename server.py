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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "mysupersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

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
    book_id: str
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

@api_router.get("/books", response_model=List[Book])
def get_books():
    return list(BOOKS_DB.values())

# -----------------------------
# ROOT
# -----------------------------
@app.get("/")
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
    if "admin@library.com" not in USERS_DB:
        USERS_DB["admin@library.com"] = {
            "email": "admin@library.com",
            "name": "Admin",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        }
        logger.info("Admin created: admin@library.com / admin123")

    scheduler.start()
    logger.info("Scheduler started")

app.include_router(api_router)

