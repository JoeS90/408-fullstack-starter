function selectWorld()
{
  var world = document.getElementById("world-select").value;
  alert("World select not implemented"); /* TODO: link to world page */
}

function noteEditToggle(button)
{
  const noteArea = button.closest('.NoteArea');
  const textArea = noteArea.querySelector('textarea');

  if(textArea.hasAttribute('readonly'))
  {
    textArea.removeAttribute('readonly')
    textArea.focus();
    button.innerText = 'Save';
    /* TODO: Change style? */
  }
  else
  {
    textArea.setAttribute('readonly', true);
    button.innerText = 'Edit';
    /* TODO: Save change to database */
    alert("Save not implemented");
  }
}

