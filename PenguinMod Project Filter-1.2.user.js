// ==UserScript==
// @name         PenguinMod Project Filter
// @description  Hides projects containing specific keywords from PenguinMod project search results, front page, etc.
// @namespace    https://github.com/the-can-of-soup
// @version      1.2
// @author       https://penguinmod.com/profile?user=soup
// @match        https://penguinmod.com/*
// @run-at       document-start
// @icon         https://www.google.com/s2/favicons?sz=64&domain=penguinmod.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  const defaultFilteredWords = ['numberblock', 'sprunki', 'incredibox'];
  let filteredWords = GM_getValue('filteredWords', defaultFilteredWords);
  let filterDisabled = GM_getValue('filterDisabled', false);
  let filteredProjectIDs = new Set();

  const oldFetch = unsafeWindow.fetch;

  async function patchedFetch(...args) {
    if (typeof args[0] === 'string') {
      let url = null;
      try {
        url = new URL(args[0]);
      } catch {
        // noop
      }

      if (url !== null) {
        let response = await oldFetch(...args);
        return await handleSuccessfulURLFetch(url, response);
      }
    }

    return await oldFetch(...args);
  }

  unsafeWindow.fetch = patchedFetch;

  async function handleSuccessfulURLFetch(url, response) {
    let responseClone = response.clone();

    if (url.hostname === 'projects.penguinmod.com') {
      let responseJSON;

      switch (url.pathname) {

        case '/api/v1/projects/frontpage':
          responseJSON = await response.json();
          checkProjectJSONs(responseJSON.featured, responseJSON.latest, responseJSON.tagged, responseJSON.voted);
          break;

        case '/api/v1/projects/searchprojects':
          responseJSON = await response.json();
          checkProjectJSONs(responseJSON);
          break;

        /*
        case '/api/v1/projects/getmyprojects':
          responseJSON = await response.json();
          checkProjectJSONs(responseJSON);
          break;
        */

        default:
          // noop
      }

    }

    return responseClone;
  }

  function checkProjectJSON(projectJSON) {
    if (filterDisabled) {
      return;
    }

    let filter = false;

    for (let keyword of filteredWords) {
      filter ||= projectJSON.title.toLowerCase().includes(keyword.toLowerCase())
        || projectJSON.instructions.toLowerCase().includes(keyword.toLowerCase())
        || projectJSON.notes.toLowerCase().includes(keyword.toLowerCase());
      if (filter) {
        break;
      }
    }

    if (filter) {
      filteredProjectIDs.add(projectJSON.id);
    }
  }

  function checkProjectJSONs(...projectJSONs) {
    for (let projectJSON of projectJSONs) {
      if (Array.isArray(projectJSON)) {
        checkProjectJSONs(...projectJSON);
      } else {
        checkProjectJSON(projectJSON);
      }
    }

    console.log('PenguinMod Project Filter now hiding:');
    console.log(filteredProjectIDs);
  }

  function handleMutations(mutations) {
    for (let mutation of mutations) {
      for (let addedNode of mutation.addedNodes) {
        handleAddedNode(addedNode);
      }
    }
  }

  let observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {subtree: true, childList: true});

  function handleAddedNode(addedNode) {
    if (addedNode instanceof Element) {
      if (addedNode.classList.contains('project')) {
        handleAddedProject(addedNode);
      } else if (settingsButtonShouldBeCreatedDueToExistenceOfNode(addedNode)) {
        createSettingsButton();

        if (!addedNode.classList.contains('profile-dropdown')) {
          // If this node is a button in the navigation bar without a unique class (this is true
          // only for the sign in and sign up buttons), move settings button after search bar;
          // otherwise, move it after this node.

          if (addedNode.classList.contains('button') && !addedNode.classList.contains('ca-themeSwitcher') && !addedNode.classList.contains('ca-languageButton')) {
            advanceSettingsButtonToAfter(document.getElementsByClassName('search')[0]);
          } else {
            advanceSettingsButtonToAfter(addedNode);
          }
        }
      }
    }
  }

  function handleAddedProject(projectNode) {
    let projectID = new URL(projectNode.firstElementChild.href).hash.slice(1);
    if (filteredProjectIDs.has(projectID)) {
      projectNode.remove();
    }
  }

  function settingsButtonShouldBeCreatedDueToExistenceOfNode(node) {
    // Returns true if the settings button should be created because the given node exists.
    // This is true for a button other than the language selector button in the navigation bar after the search bar.
    return node instanceof Element
      && (node.tagName.toLowerCase() === 'button' || (node.firstElementChild !== null && node.firstElementChild.tagName.toLowerCase() === 'button'))
      && node.parentElement.classList.contains('bar')
      && document.getElementsByClassName('search')[0].compareDocumentPosition(node) === Node.DOCUMENT_POSITION_FOLLOWING
      && !node.classList.contains('ca-languageButton');
  }

  let settingsButton = null;

  function createSettingsButton() {
    if (settingsButton !== null) {
      return;
    }

    GM_addStyle(`
    .project-filter-button {
      background-color: transparent;
      border: 0px;
      border-radius: 4px;
      cursor: pointer;
      padding: calc(0.5rem - 1.85px);
    }

    .project-filter-button:hover {
      background-color: #0000001a;
    }
    `);

    let navigationBar = document.getElementsByClassName('bar')[0];
    settingsButton = document.createElement('button');
    settingsButton.classList.add('project-filter-button');
    settingsButton.title = 'Project Filter';
    let settingsButtonImage = document.createElement('img');
    settingsButtonImage.src = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI2NS44OTMxNSIgaGVpZ2h0PSI1MS41ODE0MiIgdmlld0JveD0iMCwwLDY1Ljg5MzE1LDUxLjU4MTQyIj48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjA3LjA1MzQyLC0xNTYuOTg2NTQpIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIj48cGF0aCBkPSJNMjEyLjIyMjM3LDE1OC45ODY1NGg1NS41NTUyNmwtMjEuODU0NDYsMTkuODg5ODh2MTkuMTkyODFsLTExLjg0NjM0LDYuOTk1MTF2LTI2LjE4NzkyeiIvPjwvZz48L2c+PC9zdmc+PCEtLXJvdGF0aW9uQ2VudGVyOjMyLjk0NjU3NzMwNzEwODg3OjIzLjAxMzQ1NTAxOTc4NDkxNC0tPg==';
    settingsButtonImage.width = '30';
    settingsButtonImage.style = 'position: relative; top: 2px;';
    settingsButton.appendChild(settingsButtonImage);
    navigationBar.appendChild(settingsButton);

    settingsButton.onclick = function() {
      let response = prompt(
        'Enter a list of keywords separated by commas to be filtered. Spaces are not ignored.'
        +' You can also put an exclamation mark at the start to disable filter entirely.'
        +' Confirming will refresh the page.'
        +'\n\nThe filter only applies to the front page and search results.'
        +'\n\nDefault value: ' + (defaultFilteredWords.join(',')),
        (filterDisabled ? '!' : '') + filteredWords.join(',')
      );
      if (response === null) {
        return;
      }
      if (response === '') {
        filteredWords = [];
        filterDisabled = false;
      } else if (response.startsWith('!')) {
        filteredWords = response.slice(1).split(',');
        filterDisabled = true;
      } else {
        filteredWords = response.split(',');
        filterDisabled = false;
      }
      GM_setValue('filteredWords', filteredWords);
      GM_setValue('filterDisabled', filterDisabled);
      location.reload();
    }
  }

  let settingsButtonAfterNode = null;

  function advanceSettingsButtonToAfter(afterNode) {
    if (settingsButton === null) {
      return;
    }

    let lastAfterNodeIndex;
    let afterNodeIndex;
    for (let i = 0; i < settingsButton.parentNode.childNodes.length; i++) {
      let siblingNode = settingsButton.parentNode.childNodes[i];
      if (settingsButtonAfterNode !== null && siblingNode === settingsButtonAfterNode) {
        lastAfterNodeIndex = i;
      } else if (siblingNode === afterNode) {
        afterNodeIndex = i;
      }
    }

    if (settingsButtonAfterNode === null || afterNodeIndex > lastAfterNodeIndex) {
      if (afterNodeIndex === settingsButton.parentNode.childNodes.length - 1) {
        settingsButton.parentNode.moveBefore(settingsButton, null);
      } else {
        settingsButton.parentNode.moveBefore(settingsButton, settingsButton.parentNode.childNodes[afterNodeIndex + 1]);
      }

      settingsButtonAfterNode = afterNode;
    }
  }

  /*
  for (let childElement of document.getElementsByClassName('bar')[0].children) {
    handleAddedNode(childElement);
  }
  */
})();
