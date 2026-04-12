function selectWorld()
{
  var world = document.getElementById("world-select").value;
  if(world)
  {
    window.location.href = world;
  }
}

async function deleteWorld(id, name)
{
  try
  {
    const r1 = await fetch(`/allEntries/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const d1 = await r1.json();
    const numEntries = d1.entries.length;

    const confirmed = confirm(`${name} has ${numEntries} entries. All entries will be permanently deleted. Are you sure?`);

    if(confirmed)
    {
      const r2 = await fetch(`/deleteCollection/${id}`, {
        method: 'DELETE'
      });

      if(r2.ok)
      {
        alert(`${name} has been lost to the void.`);
        window.location.href = '/home';
        return;
      }
      else
      {
        const d2 = await r2.json();
        alert(`Failed to delete ${name}:` + d2.error);
      }
    }
  }
  catch(e)
  {
    alert(`Failed to delete ${name}:` + e.message);
  }
}

async function titleEditToggle(button)
{
  const titleArea = button.closest('.TitleArea');
  const title = titleArea.querySelector('input');
  const origTitle = titleArea.dataset.title;
  const entryType = titleArea.dataset.type;
  const collectionId = titleArea.dataset.cid;

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
          body: JSON.stringify({collectionId, entryType, newTitle})
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
  const collectionId = noteArea.dataset.cid;
  const entryId = noteArea.dataset.eid;
  const entryType = noteArea.dataset.type;
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
        body: JSON.stringify({collectionId, entryId, entryType, field, newText})
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

async function uploadImage(event)
{
  const file = event.target.files[0];

  if(!file) return;

  const imageArea = event.target.closest('.ImageArea');
  const payload = new FormData();

  payload.append('image', file);
  payload.append('collectionId', imageArea.dataset.cid);
  payload.append('entryId', imageArea.dataset.eid);
  payload.append('entryType', imageArea.dataset.type);

  try
  {
    const response = await fetch('/updateImage', {
      method: 'POST',
      body: payload
    });

    const data = await response.json();

    if(!response.ok)
    {
      throw new Error(data.error || "Save failed.");
    }
    else
    {
      const display = imageArea.querySelector('#EntryImage');
      display.src = data.imagePath;

      event.target.value = '';
    }
  }
  catch(e)
  {
    console.log(e);
    alert(e.message);
  }
}
