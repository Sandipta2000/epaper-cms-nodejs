const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();
const SECRET_KEY = process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY'; // Use environment variable for production
const PORT = process.env.PORT || 3000; // Use Render's PORT environment variable

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const usersFile = './users.json';
const epapersFile = './epapers.json';
const brandingFile = './branding.json';

// Helper function to parse DD/MM/YYYY date
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Helper function to convert YYYY-MM-DD to DD/MM/YYYY
function convertToDDMMYYYY(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Ensure the uploads folder exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

/* ---------- Middleware: Check Authentication ---------- */
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

const authorize = (roles) => {
    return (req, res, next) => {
        const users = JSON.parse(fs.readFileSync(usersFile));
        const user = users.find(u => u.id === req.user.id);
        
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: 'Access Denied. Insufficient permissions.' });
        }
        req.user.role = user.role;
        req.user.name = user.name;
        next();
    };
};

/* ---------- Multer Setup ---------- */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* ---------- LOGIN ---------- */
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!fs.existsSync(usersFile)) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }

    const users = JSON.parse(fs.readFileSync(usersFile));
    const user = users.find(u => u.email === email);

    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id }, SECRET_KEY);
        res.json({ 
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
});

/* ---------- GET CURRENT USER ---------- */
app.get('/user', authenticate, (req, res) => {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    });
});

/* ---------- GET ALL EDITIONS (Protected) ---------- */
app.get('/editions', authenticate, (req, res) => {
    if (!fs.existsSync(epapersFile)) return res.json([]);
    
    const epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    res.json(epapers.sort((a, b) => parseDate(b.date) - parseDate(a.date)));
});

/* ---------- UPDATE EDITION (Protected - Editor & Admin only) ---------- */
app.put('/editions/:id', authenticate, authorize(['editor', 'admin']), (req, res) => {
    const { id } = req.params;
    const { title, date, areas } = req.body;

    if (!fs.existsSync(epapersFile)) {
        return res.status(404).json({ message: 'No editions found' });
    }

    let epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    const index = epapers.findIndex(e => e.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({ message: 'Edition not found' });
    }

    if (title) epapers[index].title = title;
    if (date) {
        const [year, month, day] = date.split('-');
        epapers[index].date = `${day}/${month}/${year}`;
    }
    if (areas !== undefined) epapers[index].areas = areas;

    fs.writeFileSync(epapersFile, JSON.stringify(epapers, null, 2));
    res.json({ message: 'Edition updated successfully!', edition: epapers[index] });
});

/* ---------- DELETE EDITION (Protected - Editor & Admin only) ---------- */
app.delete('/editions/:id', authenticate, authorize(['editor', 'admin']), (req, res) => {
    const { id } = req.params;

    if (!fs.existsSync(epapersFile)) {
        return res.status(404).json({ message: 'No editions found' });
    }

    let epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    const index = epapers.findIndex(e => e.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({ message: 'Edition not found' });
    }

    const pdf = epapers[index].pdf;
    const images = epapers[index].images || [];
    epapers.splice(index, 1);

    // Delete the PDF file
    const pdfPath = path.join(__dirname, 'uploads', pdf);
    if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
    }

    // Delete all image files
    images.forEach(imgFile => {
        const imgPath = path.join(__dirname, 'uploads', imgFile);
        if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
        }
    });

    fs.writeFileSync(epapersFile, JSON.stringify(epapers, null, 2));
    res.json({ message: 'Edition deleted successfully!' });
});


/* ---------- UPLOAD PDF (Protected) ---------- */
app.post('/upload', authenticate, upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { title, date } = req.body;
    let epapers = [];

    if (fs.existsSync(epapersFile)) {
        const fileData = fs.readFileSync(epapersFile, 'utf8');
        epapers = fileData ? JSON.parse(fileData) : [];
    }

    const id = epapers.length ? epapers[epapers.length - 1].id + 1 : 1;
    const pdfPath = path.join(__dirname, 'uploads', req.file.filename);
    const baseName = path.basename(req.file.filename, '.pdf');
    const outputDir = path.join(__dirname, 'uploads');

    try {
        // Convert PDF to PNG images using pdftoppm
        execSync(`pdftoppm "${pdfPath}" "${path.join(outputDir, baseName)}" -png`, { 
            stdio: 'pipe',
            maxBuffer: 10 * 1024 * 1024
        });

        // Collect all generated image files
        const imageFiles = fs.readdirSync(outputDir)
            .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
            .sort((a, b) => {
                const aNum = parseInt(a.match(/\d+/)[0]) || 0;
                const bNum = parseInt(b.match(/\d+/)[0]) || 0;
                return aNum - bNum;
            });

        if (imageFiles.length === 0) {
            // Delete the uploaded PDF if conversion failed
            fs.unlinkSync(pdfPath);
            return res.status(500).json({ message: 'PDF conversion failed. No images generated. Please check the PDF file.' });
        }

        // Convert date from YYYY-MM-DD to DD/MM/YYYY
        const [year, month, day] = date.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        epapers.push({
            id,
            title,
            date: formattedDate,
            pdf: req.file.filename,
            images: imageFiles,
            uploadedBy: req.user.name || 'User',
            uploadedAt: new Date().toISOString()
        });

        fs.writeFileSync(epapersFile, JSON.stringify(epapers, null, 2));
        res.json({ message: 'Epaper uploaded successfully!', images: imageFiles });
    } catch (err) {
        console.error('PDF conversion error:', err);
        // Delete the uploaded PDF if conversion failed
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }
        return res.status(500).json({ message: 'PDF conversion failed. Please check the PDF file and try again.' });
    }
});

/* ---------- GET ALL USERS (Admin only) ---------- */
app.get('/users', authenticate, authorize(['admin']), (req, res) => {
    const users = JSON.parse(fs.readFileSync(usersFile));
    
    const safeUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
    }));
    
    res.json(safeUsers);
});

/* ---------- CREATE NEW USER (Admin only) ---------- */
app.post('/users', authenticate, authorize(['admin']), (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['author', 'editor', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be author, editor, or admin.' });
    }

    const users = JSON.parse(fs.readFileSync(usersFile));
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already exists' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ message: 'Error creating user' });

        const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;

        const newUser = {
            id: newId,
            name,
            email,
            password: hash,
            role,
            createdAt: new Date().toISOString().split('T')[0]
        };

        users.push(newUser);
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

        res.status(201).json({
            message: 'User created successfully!',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt
            }
        });
    });
});

/* ---------- UPDATE USER (Admin only) ---------- */
app.put('/users/:id', authenticate, authorize(['admin']), (req, res) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    const users = JSON.parse(fs.readFileSync(usersFile));
    const index = users.findIndex(u => u.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (email && email !== users[index].email && users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already exists' });
    }

    if (name) users[index].name = name;
    if (email) users[index].email = email;
    if (role && ['author', 'editor', 'admin'].includes(role)) users[index].role = role;

    if (password) {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: 'Error updating user' });
            users[index].password = hash;
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
            
            res.json({ 
                message: 'User updated successfully!',
                user: {
                    id: users[index].id,
                    name: users[index].name,
                    email: users[index].email,
                    role: users[index].role
                }
            });
        });
    } else {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        res.json({ 
            message: 'User updated successfully!',
            user: {
                id: users[index].id,
                name: users[index].name,
                email: users[index].email,
                role: users[index].role
            }
        });
    }
});

/* ---------- DELETE USER (Admin only) ---------- */
app.delete('/users/:id', authenticate, authorize(['admin']), (req, res) => {
    const { id } = req.params;

    const users = JSON.parse(fs.readFileSync(usersFile));
    const index = users.findIndex(u => u.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (users[index].role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
    }

    users.splice(index, 1);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    res.json({ message: 'User deleted successfully!' });
});

/* ---------- GET LATEST ---------- */
app.get('/latest', (req, res) => {
    if (!fs.existsSync(epapersFile)) return res.json(null);
    
    const epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    if (epapers.length === 0) return res.json(null);

    // Sort by date descending and get the most recent one
    const sortedEpapers = epapers.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    res.json(sortedEpapers[0]);
});

/* ---------- RECONVERT PDF TO IMAGES (Protected - Editor & Admin only) ---------- */
app.post('/editions/:id/reconvert', authenticate, authorize(['editor', 'admin']), (req, res) => {
    const { id } = req.params;

    if (!fs.existsSync(epapersFile)) {
        return res.status(404).json({ message: 'No editions found' });
    }

    let epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    const index = epapers.findIndex(e => e.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({ message: 'Edition not found' });
    }

    const pdfPath = path.join(__dirname, 'uploads', epapers[index].pdf);
    if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ message: 'PDF file not found' });
    }

    const baseName = path.basename(epapers[index].pdf, '.pdf');
    const outputDir = path.join(__dirname, 'uploads');

    try {
        // Delete existing images
        const existingImages = epapers[index].images || [];
        existingImages.forEach(img => {
            const imgPath = path.join(outputDir, img);
            if (fs.existsSync(imgPath)) {
                fs.unlinkSync(imgPath);
            }
        });

        // Convert PDF to PNG images
        execSync(`pdftoppm "${pdfPath}" "${path.join(outputDir, baseName)}" -png`, { 
            stdio: 'pipe',
            maxBuffer: 10 * 1024 * 1024
        });

        // Collect all generated image files
        const imageFiles = fs.readdirSync(outputDir)
            .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
            .sort((a, b) => {
                const aNum = parseInt(a.match(/\d+/)[0]) || 0;
                const bNum = parseInt(b.match(/\d+/)[0]) || 0;
                return aNum - bNum;
            });

        epapers[index].images = imageFiles;
        fs.writeFileSync(epapersFile, JSON.stringify(epapers, null, 2));
        res.json({ message: 'Images re-converted successfully!', images: imageFiles });
    } catch (err) {
        console.error('Re-conversion error:', err);
        res.status(500).json({ message: 'Failed to re-convert images' });
    }
});

/* ---------- GET ARCHIVE ---------- */
app.get('/archive', (req, res) => {
    if (!fs.existsSync(epapersFile)) return res.json([]);

    const epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
    // Sort by date descending
    res.json(epapers.sort((a, b) => parseDate(b.date) - parseDate(a.date)));
});

/* ---------- GET EPAPER BY DATE ---------- */
app.get('/epaper', (req, res) => {
    const { date } = req.query;
    if (!fs.existsSync(epapersFile)) return res.json(null);
    
    try {
        const epapers = JSON.parse(fs.readFileSync(epapersFile, 'utf8'));
        const formattedDate = convertToDDMMYYYY(date);
        const epaper = epapers.find(e => e.date === formattedDate);
        res.json(epaper || null);
    } catch (err) {
        console.error('Error parsing epapers.json:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ---------- BRANDING MANAGEMENT ---------- */
app.get('/branding', (req, res) => {
    if (!fs.existsSync(brandingFile)) {
        return res.json({ logo: null, favicon: null });
    }
    
    try {
        const branding = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        res.json(branding);
    } catch (err) {
        console.error('Error reading branding.json:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/branding/logo', authenticate, authorize(['admin']), upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No logo file uploaded' });
    }
    
    try {
        let branding = { logo: null, favicon: null };
        if (fs.existsSync(brandingFile)) {
            branding = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        }
        
        // Remove old logo if exists
        if (branding.logo) {
            const oldLogoPath = path.join('./uploads', branding.logo);
            if (fs.existsSync(oldLogoPath)) {
                fs.unlinkSync(oldLogoPath);
            }
        }
        
        branding.logo = req.file.filename;
        fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2));
        
        res.json({ message: 'Logo uploaded successfully' });
    } catch (err) {
        console.error('Error uploading logo:', err);
        res.status(500).json({ message: 'Upload failed' });
    }
});

app.delete('/branding/logo', authenticate, authorize(['admin']), (req, res) => {
    try {
        if (!fs.existsSync(brandingFile)) {
            return res.status(404).json({ message: 'No branding configuration found' });
        }
        
        const branding = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        
        if (branding.logo) {
            const logoPath = path.join('./uploads', branding.logo);
            if (fs.existsSync(logoPath)) {
                fs.unlinkSync(logoPath);
            }
            branding.logo = null;
            fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2));
        }
        
        res.json({ message: 'Logo removed successfully' });
    } catch (err) {
        console.error('Error removing logo:', err);
        res.status(500).json({ message: 'Removal failed' });
    }
});

app.post('/branding/favicon', authenticate, authorize(['admin']), upload.single('favicon'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No favicon file uploaded' });
    }
    
    try {
        let branding = { logo: null, favicon: null };
        if (fs.existsSync(brandingFile)) {
            branding = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        }
        
        // Remove old favicon if exists
        if (branding.favicon) {
            const oldFaviconPath = path.join('./uploads', branding.favicon);
            if (fs.existsSync(oldFaviconPath)) {
                fs.unlinkSync(oldFaviconPath);
            }
        }
        
        branding.favicon = req.file.filename;
        fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2));
        
        res.json({ message: 'Favicon uploaded successfully' });
    } catch (err) {
        console.error('Error uploading favicon:', err);
        res.status(500).json({ message: 'Upload failed' });
    }
});

app.delete('/branding/favicon', authenticate, authorize(['admin']), (req, res) => {
    try {
        if (!fs.existsSync(brandingFile)) {
            return res.status(404).json({ message: 'No branding configuration found' });
        }
        
        const branding = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        
        if (branding.favicon) {
            const faviconPath = path.join('./uploads', branding.favicon);
            if (fs.existsSync(faviconPath)) {
                fs.unlinkSync(faviconPath);
            }
            branding.favicon = null;
            fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2));
        }
        
        res.json({ message: 'Favicon removed successfully' });
    } catch (err) {
        console.error('Error removing favicon:', err);
        res.status(500).json({ message: 'Removal failed' });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

console.log(__dirname);
