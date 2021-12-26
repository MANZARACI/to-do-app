const checkboxes = document.getElementsByClassName(`isDone`);

for(let i of checkboxes) {
    i.addEventListener(`change`, function() {
        this.form.submit();
    });
}