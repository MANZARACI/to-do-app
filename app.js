if(process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require(`express`);
const path = require(`path`);
const mongoose = require(`mongoose`);
const ejsMate = require(`ejs-mate`);
const session = require(`express-session`);
const flash = require(`connect-flash`);
const Joi = require(`joi`);
const catchAsync = require(`./utils/catchAsync`);
const ExpressError = require(`./utils/ExpressError`);
const methodOverride = require(`method-override`);
const passport = require(`passport`);
const LocalStrategy = require(`passport-local`);
const User = require(`./models/user`);
const ToDo = require(`./models/todo`);
const {isLoggedIn, validateToDo, isOwner} = require(`./middleware`);
const mongoSanitize = require(`express-mongo-sanitize`);
const helmet = require(`helmet`);
const { MongoStore } = require("connect-mongo");
const MongoDBStore = require(`connect-mongo`)(session);

const dbUrl = process.env.DB_URL || `mongodb://localhost:27017/to-do-app`;
mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on(`error`, console.error.bind(console, `connection error:`));
db.once(`open`, () => {
    console.log(`Database connected`);
});

const app = express();

app.engine(`ejs`, ejsMate);
app.set(`view engine`, `ejs`);
app.set(`views`, path.join(__dirname, `views`));

app.use(express.urlencoded({extended: true}));
app.use(methodOverride(`_method`));
app.use(express.static(path.join(__dirname, `public`)));
app.use(mongoSanitize({
    replaceWith: `_`
}));

const secret = process.env.SECRET || `thisshouldbeabettersecret!`;

const store = new MongoDBStore({
    url: dbUrl,
    secret,
    touchAfter: 24 * 60 * 60
});

store.on(`error`, function(e) {
    console.log(`SESSION STORE ERROR`, e);
});

const sessionConfig = {
    store,
    name: `session`,
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        //secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));
app.use(flash());
app.use(helmet({ contentSecurityPolicy: false }));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash(`success`);
    res.locals.error = req.flash(`error`);
    next();
})

app.get(`/`, (req, res) => {
    res.render(`home`)
})

app.get(`/register`, (req, res) => {
    res.render(`users/register`)
})

app.post(`/register`, catchAsync(async(req, res) => {
    try {
        const {email, username, password} = req.body;
        const user = new User({email, username});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if(err) return next(err);
            req.flash(`success`, `Welcome to ToDo`);
            res.redirect(`/`);
        })  
    } catch(e) {
        req.flash(`error`, e.message);
        res.redirect(`/register`);
    }   
}));

app.get(`/login`, (req, res) => {
    res.render(`users/login`)
})

app.post(`/login`, passport.authenticate(`local`, {failureFlash: true, failureRedirect: `/login`}), (req, res) => {
    req.flash(`success`, `Welcome back!`);
    const redirectUrl = req.session.returnTo || `/`;
    res.redirect(redirectUrl);
})

app.get(`/logout`, (req, res) => {
    req.logout();
    req.flash(`success`, `Goodbye!`);
    res.redirect(`/`);
})

app.get(`/todos`, isLoggedIn, catchAsync(async(req, res) => {
    const user = await User.findById(req.user._id).populate(`todos`);
    const todos = user.todos;
    res.render(`todos/index`, { todos });
}))

app.get(`/newToDo`, isLoggedIn, (req, res) => {
    const today = new Date();
    let month = today.getMonth()+1;
    let day = today.getDate();
    if(month.toString().length < 2) {
        month = `0`+ month.toString();
    }
    if(day.toString().length < 2) {
        day = `0`+ day.toString();
    }
    let date = today.getFullYear()+'-'+month+'-'+day;
    res.render(`todos/new`, { date });
})

app.post(`/todos`, isLoggedIn, validateToDo, catchAsync(async (req, res) => {
    const today = new Date();
    let month = today.getMonth()+1;
    let day = today.getDate();
    if(month.toString().length < 2) {
        month = `0`+ month.toString();
    }
    if(day.toString().length < 2) {
        day = `0`+ day.toString();
    }
    let date = today.getFullYear()+'-'+month+'-'+day;
    const todo = new ToDo(req.body.todo);
    todo.dateAdded = date;
    todo.owner = req.user._id;
    await todo.save();
    const user = await User.findById(req.user._id);
    user.todos.push(todo._id);
    await user.save();
    req.flash(`success`, `Successfully made a new todo!`);
    res.redirect(`/todos`);
}))

app.get(`/todos/:id/edit`, isLoggedIn, isOwner, catchAsync(async(req, res) => {
    const {id} = req.params;
    const todo = await ToDo.findById(id);
    if(!todo) {
        req.flash(`error`, `Cannot find that todo!`);
        return res.redirect(`/todos`);
    }
    let month = todo.deadline.getMonth()+1;
    let day = todo.deadline.getDate();
    if(month.toString().length < 2) {
        month = `0`+ month.toString();
    }
    if(day.toString().length < 2) {
        day = `0`+ day.toString();
    }
    let date = todo.deadline.getFullYear()+'-'+month+'-'+day;
    res.render(`todos/edit`, {todo, date});
}))

app.put(`/todos/:id/changeIsDone`, isLoggedIn, isOwner, catchAsync(async(req, res) => {
    const {id} = req.params;
    const todo = await ToDo.findById(id);
    if(todo.isDone) {
        todo.isDone = false;
    } else {
        todo.isDone = true;
    }
    await todo.save();
    res.redirect(`/todos`);
}))

app.put(`/todos/:id`, isLoggedIn, isOwner, validateToDo, catchAsync(async(req, res) => {
    const {id} = req.params;
    const todo = await ToDo.findByIdAndUpdate(id, {...req.body.todo});
    await todo.save();
    req.flash(`success`, `Successfully updated todo!`);
    res.redirect(`/todos`);
}))

app.delete(`/todos/:id`, isLoggedIn, isOwner, catchAsync(async(req, res) => {
    const {id} = req.params;
    await ToDo.findByIdAndDelete(id);
    req.flash(`success`, `Successfully deleted todo`);
    res.redirect(`/todos`);
}))

app.all(`*`, (req, res, next) => {
    next(new ExpressError(`Page Not Found`, 404))
})

app.use((err, req, res, next) => {
    const {statusCode=500} = err;
    if(!err.message) err.message = `Oh No, Something Went Wrong!`;
    res.status(statusCode).render(`error`, {err});
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})