const {todoSchema} = require(`./schemas.js`);
const ExpressError = require(`./utils/ExpressError`);
const ToDo = require(`./models/todo`);

module.exports.isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash(`error`, `You must be signed in`);
        return res.redirect(`/login`);
    }
    next();
}

module.exports.validateToDo = (req, res, next) => {
    const { error } = todoSchema.validate(req.body)
    if(error) {
        const msg = error.details.map(el => el.message).join(`,`);
        throw new ExpressError(msg, 400);
    } else {
        next();
    }
};

module.exports.isOwner = async(req, res, next) => {
    const {id} = req.params;
    const todo = await ToDo.findById(id);
    if(todo) {
        if(!todo.owner.equals(req.user._id)) {
            req.flash(`error`, `You do not have permission to do that!`);
            return res.redirect(`/todos`);
        }
    }
    next();
}