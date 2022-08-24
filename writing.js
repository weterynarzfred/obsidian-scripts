class Writing {
  init(dv) {
    window.Writing = this;
    this.dv = dv;
    return this;
  }

  toArrayOption(value, callback) {
    if (value === undefined) return [];
    const result = Array.isArray(value) ? value : [value];
    return callback === undefined ? result : result.map(callback);
  }

  isEmpty(value) {
    if ([undefined, '', ' ', null].includes(value)) return true;
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.length === 0;
      else return (Object.keys(value).length === 0);
    }
    return false;
  }

  isCharacterInProse(prosePage, characterPath) {
    return prosePage.pov?.path === characterPath ||
      this.toArrayOption(prosePage.character, character => character?.path)
        .includes(characterPath);
  }

  _getPageWordCount(page, resolve) {
    const cachedCounts = this.dv.app.plugins.plugins['novel-word-count'].savedData.cachedCounts;
    if (Object.keys(cachedCounts).length === 0) {
      setTimeout(this._getPageWordCount.bind(this, page, resolve), 1000);
      return;
    }

    const getCountData = this.dv.app.plugins.plugins['novel-word-count'].fileHelper.getCountDataForPath;
    const countData = getCountData(cachedCounts, page.file.path);
    resolve(countData ? countData.wordCount : 0);
  }

  getPageWordCount(page) {
    return new Promise(resolve => this._getPageWordCount.call(this, page, resolve));
  }

  async displayProseTable(prose, title) {
    const titleWordCountStyle = `
display: inline-block;  
margin-left: 1em;
font-size: 1rem;
font-weight: 400;  
opacity: .75;
word-spacing: .2em;
color: var(--text-normal);
`;

    const dv = this.dv;
    let storyWordCount = 0;
    const rows = await Promise.all(prose.map(async prosePage => {
      const proseWordCount = await this.getPageWordCount(prosePage);
      storyWordCount += proseWordCount;
      const status = this.toArrayOption(prosePage.status, a => {
        return !this.isEmpty(a) && typeof a.replace === 'function' ? a.replace('#status/', '') : '';
      });
      const pov = this.toArrayOption(prosePage.pov).join(', ');
      return [
        `<small>${prosePage.order?.toString().replace('/', '.') ?? ''}</small> ${prosePage.file.link}`,
        `<small>${[pov, proseWordCount, status].filter(e => e).join(' | ')}</small>`,
        `<small>${prosePage.synopsis ?? '---'}</small>`,
      ];
    }));
    this.init(dv); // calling this again because the function might have been waiting for the character count
    this.dv.header(3, `${title ?? ''}<span style="${titleWordCountStyle}">${storyWordCount} words</span>`);
    this.dv.table(['name', 'pov/words/status', 'synopsis'], rows);
  }

  displayCharacterList(characters, currentStoryProse) {
    const annotatedCharacters = {};
    characters.forEach(characterPage => {
      annotatedCharacters[characterPage.file.path] = {
        page: characterPage,
        povCount: 0,
        characterCount: 0,
      };
    });

    currentStoryProse.forEach(prosePage => {
      if (annotatedCharacters[prosePage.pov?.path] !== undefined)
        annotatedCharacters[prosePage.pov.path].povCount++;

      const characters = this.toArrayOption(prosePage.character);
      characters.forEach(characterLink => {
        if (annotatedCharacters[characterLink?.path] !== undefined)
          annotatedCharacters[characterLink.path].characterCount++;
      });
    });

    const characterTable = Object.values(annotatedCharacters)
      .sort((a, b) => a.povCount === b.povCount ? b.characterCount - a.characterCount : b.povCount - a.povCount)
      .map(annotatedCharacter => `${annotatedCharacter.page.file.link}<span style="display: inline-block; margin-left: 1em; opacity: .5; font-size: .8rem; word-spacing: .2em; font-weight: 400;">(${annotatedCharacter.povCount + annotatedCharacter.characterCount})</span>`);

    this.dv.list(characterTable);
  }

  getAdjacentProse(currentFilePath) {
    const result = {};

    const currentPage = this.dv.page(currentFilePath);
    if (this.isEmpty(currentPage.story)) return result;

    const currentStoryProse = this.dv.pages(`#prose and -"templates"`)
      .sort(e => e.order ?? e.file.name)
      .filter(e => e.story?.path === currentPage.story.path);

    if (currentStoryProse.length <= 1) return result;

    const currentIndex = currentStoryProse.values
      .findIndex(e => e.file.path === currentFilePath);

    if (currentIndex === -1) return result;
    if (currentIndex !== 0) result.prev = currentStoryProse[currentIndex - 1];
    if (currentIndex !== currentStoryProse.length - 1) result.next = currentStoryProse[currentIndex + 1];

    return result;
  }

  displayAdjacentProse(dv) {
    this.init(dv);
    const adjacent = this.getAdjacentProse(dv.currentFilePath);
    if (Object.keys(adjacent).length === 0) return;

    const linkStyle = `
display: block;
padding: .5em 1.5em;
font-family: sans-serif;
font-size: .8em;
margin: .5em;
text-align: center;
`;

    const linkLabelStyle = `
display: block;
opacity: .5;
font-size: .8em;
text-transform: uppercase;
letter-spacing: .2em;
word-spacing: .2em;
padding-left: .2em;
`;

    let content = '<span style="padding-top: 2em; display: flex; justify-content: center;">';
    if (adjacent.prev !== undefined) content += `<span style="${linkStyle}"><span style="${linkLabelStyle}">prev</span>${adjacent.prev.file.link}</span>`;
    content += `<span style="${linkStyle}"><span style="${linkLabelStyle}">index</span>${this.dv.page('_index.md').file.link}</span>`;
    if (adjacent.next !== undefined) content += `<span style="${linkStyle}"><span style="${linkLabelStyle}">next</span>${adjacent.next.file.link}</span>`;
    content += '</span>';
    this.dv.el(
      'div',
      content
    );
  }

  async displayIndex(dv) {
    this.init(dv);
    const prosePages = this.dv.pages(`#prose and -"templates"`).sort(e => e.order ?? e.file.name);
    const storyPages = this.dv.pages(`#story and -"templates"`).sort(e => e.file.name);
    window.otherProse = prosePages.filter(e => !e.story);

    for (const storyPage of storyPages) {
      const currentStoryProse = prosePages.filter(e => e.story?.path === storyPage.file.path);
      await this.displayProseTable(currentStoryProse, storyPage.file.link);
    }
    window.otherProse = window.otherProse.sort(e => -(this.getPageWordCount(e)));
    this.displayProseTable(otherProse, 'Other Prose');
  }

  displayIndexOtherCharacters(dv) {
    this.init(dv);

    const characterPages = this.dv.pages(`#character and -"templates"`);
    const filteredCharacters = characterPages
      .filter(characterPage => characterPage.story === undefined);

    this.displayCharacterList(filteredCharacters, window.otherProse);
  }

  async displayCharacterProse(dv) {
    this.init(dv);

    const currentCharacterProse = this.dv.pages(`#prose and -"templates"`)
      .sort(e => e.order ?? e.file.name)
      .filter(e => this.isCharacterInProse(e, dv.currentFilePath));

    this.displayProseTable(currentCharacterProse);
  }

  displayStoryProse(dv) {
    this.init(dv);

    window.currentStoryProse = this.dv.pages(`#prose and -"templates"`)
      .sort(e => e.order ?? e.file.name)
      .filter(e => e.story?.path === this.dv.currentFilePath);

    this.displayProseTable(currentStoryProse);
  }

  displayStoryCharacters(dv) {
    this.init(dv);

    const filteredCharacters = this.dv.pages(`#character and -"templates"`)
      .filter(e => e.story?.path === this.dv.currentFilePath);

    this.displayCharacterList(filteredCharacters, window.currentStoryProse);
  }
}
