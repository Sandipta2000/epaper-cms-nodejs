# Barak Bani Epaper CMS - Admin Documentation

## 🎯 System Overview

The Barak Bani Epaper CMS is a complete content management system with **role-based access control** and permission management. The system supports three user roles with different privileges:

---

## 👥 User Roles & Permissions

### 1. **ADMIN** (Supreme Access)
- ✅ Login & Access Dashboard
- ✅ Upload new epaper editions
- ✅ Edit edition details (title, date)
- ✅ Delete editions & PDF files
- ✅ View all editions
- ✅ **Manage Users** - Create, Edit, Delete users
- ✅ Assign roles to users

### 2. **EDITOR** (Moderate Access)
- ✅ Login & Access Dashboard
- ✅ Upload new epaper editions
- ✅ Edit edition details (title, date)
- ✅ Delete editions & PDF files
- ✅ View all editions
- ❌ Cannot manage users
- ❌ Cannot create/edit other users

### 3. **AUTHOR** (Limited Access)
- ✅ Login & Access Dashboard
- ✅ Upload new epaper editions
- ✅ View all editions
- ❌ Cannot edit editions
- ❌ Cannot delete editions
- ❌ Cannot manage users

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm installed
- Port 3000 available (for local development)

### Installation

```bash
cd "/home/itwing/Downloads/Epaper CMS"
npm install
npm start
```

The server will run at `http://localhost:3000`

---

## 🌐 Deployment

### Render.com Deployment
The project includes `render.yaml` for easy deployment to Render.com:

1. Push code to GitHub/GitLab
2. Connect repository to Render
3. Deploy automatically
4. Set `JWT_SECRET` environment variable

---

## 📋 Admin Console Features

### Login Page
- Visit: `http://localhost:3000/admin.html`
- Enter your email and password
- Password visibility toggle (👁️ icon)

### Dashboard Tabs (After Login)

#### 1️⃣ **Upload Edition Tab** (All Roles)
- Upload new epaper PDF files
- Enter edition title and publication date
- Real-time upload status messages
- Available to: **Author, Editor, Admin**

#### 2️⃣ **Manage Editions Tab** (All Roles)
- View all uploaded editions in a clean card layout
- Shows: Title, Publication Date, Uploader name, PDF link
- **For Editors & Admins:**
  - ✏️ Edit button: Update title and date
  - 🗑️ Delete button: Remove edition and PDF file
- **For Authors:**
  - View editions and download PDFs only

#### 3️⃣ **Manage Users Tab** (Admin Only)
- Complete user management interface
- Features:
  - ➕ Add New User button
  - Table view of all users with their roles and creation date
  - ✏️ Edit user details, role, or password
  - 🗑️ Delete users (cannot delete last admin)

---

## 🔑 Default Admin Credentials

```
Email: admin@gmail.com
Password: admin
```

---

## 👤 Creating New Users (Admin Only)

### Steps:
1. Login as Admin
2. Click **Manage Users** tab
3. Click **➕ Add New User** button
4. Fill in the form:
   - **Full Name:** User's name
   - **Email:** Unique email address
   - **Password:** Secure password
   - **Role:** Select from:
     - Author (Upload only)
     - Editor (Upload, Edit, Delete)
     - Admin (Full Access)
5. Click **Save User**

### Example Users Created:

```
Editor User:
- Name: Sandipta Halder
- Email: sandipta@example.com
- Password: sandipta123
- Role: Editor

Author User:
- Name: Rajesh Kumar
- Email: rajesh@example.com
- Password: rajesh123
- Role: Author
```

---

## 📁 File Structure

```
Epaper CMS/
├── server.js              # Main Express server with all APIs
├── users.json             # User accounts & roles (passwords hashed)
├── epapers.json           # All uploaded editions metadata
├── admins.json            # Legacy file (no longer used)
├── package.json           # Dependencies
├── public/
│   ├── admin.html         # Admin dashboard & console
│   ├── index.html         # Public home page
│   ├── archive.html       # Public archive view
│   ├── script.js          # Frontend scripts
│   ├── style.css          # Styling
│   └── logo.png           # Logo
├── uploads/               # PDF files directory
└── test.js               # Helper script (temp)
```

---

## 🔐 API Endpoints

### Authentication
- **POST** `/login` - User login
  - Body: `{ email, password }`
  - Returns: `{ token, user }`

- **GET** `/user` - Get current user info
  - Header: `Authorization: token`

### Editions Management
- **GET** `/editions` - Get all editions
  - Header: `Authorization: token`

- **POST** `/upload` - Upload new edition
  - Header: `Authorization: token`
  - Body: FormData with `title`, `date`, `pdf` file

- **PUT** `/editions/:id` - Update edition (Editor/Admin)
  - Header: `Authorization: token`
  - Body: `{ title, date }`

- **DELETE** `/editions/:id` - Delete edition (Editor/Admin)
  - Header: `Authorization: token`

### User Management (Admin Only)
- **GET** `/users` - Get all users
  - Header: `Authorization: token`

- **POST** `/users` - Create new user
  - Header: `Authorization: token`
  - Body: `{ name, email, password, role }`

- **PUT** `/users/:id` - Update user (Admin)
  - Header: `Authorization: token`
  - Body: `{ name, email, role, password? }`

- **DELETE** `/users/:id` - Delete user (Admin)
  - Header: `Authorization: token`

### Public Endpoints
- **GET** `/latest` - Get latest edition
- **GET** `/archive` - Get all editions sorted by date

---

## 💾 Data Storage

### users.json Format
```json
[
  {
    "id": 1,
    "name": "Admin User",
    "email": "admin@gmail.com",
    "password": "$2b$10$...",  // Bcrypt hashed
    "role": "admin",
    "createdAt": "2026-02-13"
  }
]
```

### epapers.json Format
```json
[
  {
    "id": 1,
    "title": "Barakbani Dainik",
    "date": "2026-02-13",
    "pdf": "1770999589269.pdf",
    "uploadedBy": "Admin User",
    "uploadedAt": "2026-02-13T10:00:00.000Z"
  }
]
```

---

## 🔒 Security Features

✅ **Password Hashing:** Bcryptjs with 10 salt rounds
✅ **JWT Authentication:** Secure token-based auth
✅ **Role-Based Access Control:** Permission enforcement
✅ **Input Validation:** All inputs validated
✅ **Secure Deletion:** PDF files deleted when editions are removed
✅ **Session Protection:** Token verification on protected endpoints

---

## 🐛 Troubleshooting

### Login Fails
- Verify email and password are correct
- Check users.json file exists
- Restart server if needed

### Cannot Upload Files
- Ensure you have correct role (Author, Editor, or Admin)
- Check uploads folder permission
- Verify PDF file size is reasonable

### Cannot Edit/Delete Editions
- Only Editors and Admins can edit/delete
- Authors can only upload
- Check your user role in profile

### Cannot Manage Users
- Only Admins can manage users
- Check your role is set to 'admin'
- Use the admin account to create/edit users

---

## 📝 Notes

- Passwords are never displayed, only changed
- Cannot delete the last admin user (system protection)
- All editions sorted by date (newest first)
- PDF files are stored in `/uploads` folder
- JWT tokens are stored in browser's localStorage

---

## ✨ Features Implemented

✅ User authentication with role-based access
✅ Complete admin dashboard
✅ Edition management (Create, Read, Update, Delete)
✅ User management (Create, Read, Update, Delete)
✅ Permission-based authorization
✅ Responsive UI with modals and tabs
✅ Real-time upload feedback
✅ Edition history with uploader info
✅ Secure password hashing with bcryptjs
✅ PDF file management

---

## 🎓 Usage Examples

### Admin Workflow:
1. Login with admin@gmail.com / admin
2. Create new editors and authors
3. Monitor all uploads
4. Edit edition details as needed
5. Delete outdated editions

### Editor Workflow:
1. Login with editor credentials
2. Upload new editions
3. Manage existing editions
4. Cannot create or manage users

### Author Workflow:
1. Login with author credentials
2. Upload new editions
3. Cannot edit or delete
4. Cannot manage users

---

**System Ready for Production Use!** ✨
