const mongoose = require(`mongoose`);
const Schema = mongoose.Schema;

const ToDoSchema = new Schema({
    title: String,
    description: String,
    dateAdded: Date,
    deadline: Date,
    owner: {
        type: Schema.Types.ObjectId,
        ref: `User`
    },
    isDone: Boolean
})

module.exports = mongoose.model(`ToDo`, ToDoSchema);