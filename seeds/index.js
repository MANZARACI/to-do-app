const mongoose = require(`mongoose`);
const todos = require(`./todos`);
const ToDo = require(`../models/todo`);
const User = require(`../models/user`);

mongoose.connect(`mongodb://localhost:27017/to-do-app`);

const db = mongoose.connection;
db.on(`error`, console.error.bind(console, `connection error:`));
db.once(`open`, () => {
    console.log(`Database connected`);
});

const seedDB = async () => {
    await ToDo.deleteMany({});
    for(let i of todos) {
        const todo = new ToDo(i);
        todo.owner = "61c61259f1a9a15b3a1c4e76";
        await todo.save();
    }
}

seedDB();