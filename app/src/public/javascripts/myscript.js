function selectWorld()
{
  var world = document.getElementById("world-select").value;
  if(world)
  {
    window.location.href = world;
  }
}

async function titleEditToggle(button)
{
  const titleArea = button.closest('.TitleArea');
  const title = titleArea.querySelector('input');
  const origTitle = titleArea.dataset.title;
  const type = titleArea.dataset.type;
  const cid = titleArea.dataset.cid;

  if(title.hasAttribute('readonly'))
  {
    title.removeAttribute('readonly');
    title.focus();
    button.innerText = 'Save';
    /* TODO: Change style? */
  }
  else
  {
    const newTitle = title.value.trim();
    
    if(newTitle === origTitle)
    {
      // Do nothing
    }
    else if(newTitle === "")
    {
      alert("There is power in names. This page cannot be invoked without one.");
      title.value = origTitle;
    }
    else
    {
      button.innerText = 'saving...';
      try
      {
        const response = await fetch('/updateTitle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({cid, type, newTitle})
        });

        if(!response.ok)
        {
          const data = await response.json();
          throw new Error(data.error || "Save failed.");
        }
      }
      catch(e)
      {
        console.log(e);
        alert(e);
        title.value = origTitle;
      }
    }
    
    titleArea.dataset.title = newTitle;
    button.innerText = 'Edit';
    title.setAttribute('readonly', true);
    return;
  }
}

async function noteEditToggle(button)
{
  const noteArea = button.closest('.NoteArea');
  const text = noteArea.querySelector('textarea');
  const cid = noteArea.dataset.cid;
  const eid = noteArea.dataset.eid;
  const type = noteArea.dataset.type;
  const field = text.id;

  if(text.hasAttribute('readonly'))
  {
    text.removeAttribute('readonly');
    text.focus();
    button.innerText = 'Save';
    /* TODO: Change style? */
  }
  else
  {
    const newText = text.value;
    button.innerText = 'saving...';
    try
    {
      const response = await fetch('/updateText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({cid, eid, type, field, newText})
      });

      if(!response.ok)
      {
        const data = await response.json();
        throw new Error(data.error || "Save failed.");
      }
    }
    catch(e)
    {
      console.log(e);
      alert(e);
    }

    button.innerText = 'Edit';
    text.setAttribute('readonly', true);
    return;
  }
}

