// author: Le Minh

const express = require('express')
const morgan = require('morgan')
const { engine } = require('express-handlebars')
const path = require('path')
const app = express()
const sql = require('mssql')
const bcrypt = require('bcrypt')
const bodyParser = require('body-parser')
const crypto = require('crypto');
const passport = require('passport')
const initializePassport = require('./passport-config')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const fs = require('fs')
const port = 3000
const route = require('./routes')
const { request } = require('http')
const exp = require('constants')

const users = []
const this_user = []

console.log(crypto.createHash('md5').update('123').digest('hex'))

const sqlConfig = {
    server: "DESKTOP-D1SFR6N",
    database: "Project_TKB",
    user: "sa",
    password: "leminh164",
    driver: "ODBC Driver 17 for SQL Server",
    options: {
        trustedConnection: true,
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: true,
    }
}

initializePassport(
    passport,
    username => {
        let found = users.find(user => user.username === username)
        if (found == null) return null
        this_user.name = found.name
        this_user.username = found.username
        this_user.password = found.password
        return found
    },
    id => users.find(user => user.id === id)
)


app.use(express.static(path.join(__dirname, 'public')))

app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())

app.use(methodOverride('_method'))

// HTTP logger
app.use(morgan('combined'))

// Template engine
app.engine('hbs', engine({
    extname: '.hbs',
}))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'resources', 'views'))
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
}))

app.use(flash())
app.use(passport.initialize())
app.use(passport.session())

// app.post('/dang-nhap', (req, res) => {
//     const request = new sql.Request()
//     request.query(`SELECT * FROM DangNhap WHERE MSHS = '${req.body.username}'`, (err, recordset) => {
//         if (err) console.log(err)
//         else {
//             if (recordset.recordset.length === 0) {
//                 res.render('dang-nhap', {
//                     error: 'Tên đăng nhập không tồn tại'
//                 })
//             }
//             else {
//                 hashedPassword = crypto.createHash('md5').update(req.body.password).digest('hex')
//                 if (recordset.recordset[0].Password === hashedPassword) {
//                     res.render('trang-ca-nhan', {
//                         user: recordset.recordset[0]
//                     })
//                 }
//                 else {
//                     res.render('dang-nhap', {
//                         error: 'Mật khẩu không đúng'
//                     })
//                 }
//             }
//         }
//     })
// })

app.post('/dang-nhap', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/dang-nhap',
    failureFlash: true,
}))

// Route init
// route(app)

app.get('/dang-nhap', checkNotAuthenticated, (req, res) => {
    sql.connect(sqlConfig, (err) => {
        if (err) console.log(err)
        else {
            let request = new sql.Request()
            request.query(`SELECT HocSinh.MSHS MSHS, Password, HoTen 
                            FROM DangNhap JOIN HocSinh ON HocSinh.MSHS = DangNhap.MSHS`,
                (err, recordset) => {
                    if (err) {
                        console.log(err);
                        sql.close();
                        return;
                    }
                    else {
                        for (let i = 0; i < recordset.recordset.length; i++) {
                            users.push({
                                id: Date.now().toString(),
                                name: recordset.recordset[i].HoTen,
                                username: recordset.recordset[i].MSHS,
                                password: recordset.recordset[i].Password,
                            })
                        }
                        sql.close();
                    }
                })
        }
    })
    res.render('dang-nhap')
})

app.get('/trang-ca-nhan', checkAuthenticated, (req, res) => {
    sql.connect(sqlConfig, (err) => {
        if (err) {
            console.log(err);
            sql.close()
        }
        else {
            let query = `SELECT * FROM HocSinh WHERE MSHS = '${this_user.username}'`
            const request = new sql.Request()
            request.query(query, (err, recordset) => {
                if (err) {
                    console.log(err)
                    sql.close()
                }
                res.render('trang-ca-nhan', {
                    MSHS: recordset.recordset[0].MSHS,
                    HoTen: recordset.recordset[0].HoTen,
                    TenLop: recordset.recordset[0].TenLop,
                    NgaySinh: recordset.recordset[0].DOB,
                    GioiTinh: recordset.recordset[0].GioiTinh,
                    SDT: recordset.recordset[0].SDT,
                })
            })

        }
    })
})

app.get('/tim-kiem', checkAuthenticated, (req, res) => {
    const maGV = req.query.maGV
    sql.connect(sqlConfig, (err) => {
        if (err) {
            console.log(err);
            sql.close()
        }
        else {
            let query = `SELECT * FROM GiaoVien WHERE MSGV = '${maGV}'`
            const request = new sql.Request()
            request.query(query, (err, recordset) => {
                if (err) {
                    console.log(err)
                    sql.close()
                }
                else {
                    if (recordset.recordset.length === 0) {
                        res.render('tim-kiem', {
                            error: `Mã giáo viên ${maGV} không tồn tại`,
                            this_user
                        })
                    }
                    else {
                        console.log(`Ho Ten: ${recordset.recordset[0].HoTen}`)
                        res.render('tim-kiem', {
                            HoTen: recordset.recordset[0].HoTen,
                            MSGV: recordset.recordset[0].MSGV,
                            SDT: recordset.recordset[0].SDT,
                            Email: recordset.recordset[0].Email,
                            ToChuyenMon: recordset.recordset[0].ToChuyenMon,
                            NgaySinh: recordset.recordset[0].DOB,
                            this_user,
                        })
                        sql.close()
                    }
                }
            })
        }
    })
})

app.get('/doi-mat-khau', checkAuthenticated, (req, res) => {
    res.render('doi-mat-khau', { this_user })
})

app.post('/doi-mat-khau', checkAuthenticated, (req, res) => {
    let oldPW = req.body.oldPW
    let newPW = req.body.newPW
    let confirmPW = req.body.confirmPW
    let hashedOldPW = crypto.createHash('md5').update(oldPW).digest('hex')
    if (this_user.password !== hashedOldPW) {
        res.render('doi-mat-khau', { error: 'Mật khẩu cũ không đúng', this_user })
    }
    else {
        if (newPW !== confirmPW) {
            res.render('doi-mat-khau', { error: 'Mật khẩu mới không khớp', this_user })
        }
        else {
            let newHashedPW = crypto.createHash('md5').update(newPW).digest('hex')
            sql.connect(sqlConfig, (err) => {
                if (err) {
                    console.log(err);
                    sql.close()
                }
                else {
                    let query = `UPDATE DangNhap 
                                SET Password = '${newHashedPW}' 
                                WHERE MSHS = '${this_user.username}'`
                    const request = new sql.Request()
                    request.query(query, (err, recordset) => {
                        if (err) {
                            console.log(err)
                            sql.close()
                        }
                        else {
                            sql.close()
                            for (let i = 0; i < users.length; i++) {
                                if (users[i].username === this_user.username) {
                                    users[i].password = newHashedPW
                                    break
                                }
                            }
                            req.logOut(function (err) {
                                if (err) console.log(err)
                                res.redirect('/dang-nhap')
                            })
                        }
                    })
                }
            })
        }
    }
})

app.get('/', checkAuthenticated, (req, res) => {
    sql.connect(sqlConfig, (err) => {
        if (err) {
            console.log(err);
            sql.close()
        }
        else {
            let query = `SELECT TKB.TenLop Lop, CaHoc, Thu, Phong, TenMon, GiaoVien.HoTen TenGV, HocSinh.HoTen TenHS
                        FROM TKB JOIN MonHoc ON TKB.MaMon = MonHoc.MaMon 
                        JOIN GiaoVien ON TKB.MSGV = GiaoVien.MSGV
                        JOIN HocSinh ON TKB.TenLop = HocSinh.TenLop
                        WHERE MSHS = '${this_user.username}'
                        ORDER BY Thu, CaHoc`
            const request = new sql.Request()
            request.query(query, (err, recordset) => {
                if (err) {
                    console.log(err)
                    sql.close()
                }
                else {
                    let Ca1 = []
                    let Ca2 = []
                    let Ca3 = []
                    let Lop = []
                    let HoTen = []
                    Lop.push(recordset.recordset[0].Lop)
                    HoTen.push(recordset.recordset[0].TenHS)
                    for (let i = 0; i < recordset.recordset.length; i++) {
                        if (recordset.recordset[i].CaHoc === 'Ca 1') {
                            Ca1.push(recordset.recordset[i])
                        }
                        else if (recordset.recordset[i].CaHoc === 'Ca 2') {
                            Ca2.push(recordset.recordset[i])
                        }
                        else {
                            Ca3.push(recordset.recordset[i])
                        }
                    }
                    sql.close()
                    res.render('home', {
                        Lop,
                        Ca1,
                        Ca2,
                        Ca3,
                        HoTen,
                        this_user,
                    })
                }
            })
        }
    })
})

app.delete('/dang-xuat', (req, res) => {
    req.logOut(function (err) {
        if (err) console.log(err)
        res.redirect('/dang-nhap')
    })
})

// app.post('/dang-nhap', (req, res) => {
//     res.render('dang-nhap')
// })


// sql.connect(sqlConfig, (err) => {
//     if (err) console.log(err)
//     else {
//         const request = new sql.Request()
//         request.query('SELECT * FROM HocSinh', (err, recordset) => {
//             if (err) console.log(err)
//             else console.log(recordset)
//         })
//     }
// })

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect('/dang-nhap')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

app.listen(port, () => console.log(`App listening on port ${port}!`))