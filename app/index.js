'use strict';
var path = require('path');
var util = require('util');
var spawn = require('child_process').spawn;
var yeoman = require('yeoman-generator');

var ChromeExtensionGenerator = module.exports = function ChromeExtensionGenerator(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);

  // set source root path to templates
  this.sourceRoot(path.join(__dirname, 'templates'));

  // init extension manifest data
  this.manifest = {
    permissions:{}
  };

  // setup the test-framework property, Gruntfile template will need this
  this.testFramework = options['test-framework'] || 'mocha';
  this.coffee = options.coffee;
  this.compass = options.compass;

  // copy script with js or coffee extension
  this.copyjs = function copyjs(src, dest) {
    var ext = this.coffee ? '.coffee' : '.js';

    src = src + ext;
    dest = dest ? dest + ext : src;
    this.copy((this.coffee ? 'coffees/' : 'scripts/') + src, 'app/scripts/' + dest);
  };

  // for hooks to resolve on mocha by default
  options['test-framework'] = this.testFramework;

  // resolved to mocha by default (could be switched to jasmine for instance)
  this.hookFor('test-framework', {
    as: 'app',
    options: {
      options: {
        'skip-install': options['skip-install-message'],
        'skip-message': options['skip-install']
      }
    }
  });

  this.options = options;

  this.pkg = JSON.parse(this.readFileAsString(path.join(__dirname, '../package.json')));
};

util.inherits(ChromeExtensionGenerator, yeoman.generators.Base);

ChromeExtensionGenerator.prototype.askFor = function askFor(argument) {
  var cb = this.async();

  var prompts = [
    {
      name: 'name',
      message: 'What would you like to call this extension?',
      default: (this.appname) ? this.appname : 'myChromeApp'
    },
    {
      name: 'description',
      message: 'How would you like to describe this extension?',
      default: 'My Chrome Extension'
    },
    {
      type: 'list',
      name: 'action',
      message: 'Would you like to use UI Action?',
      choices:[
        'No',
        'Browser',
        'Page'
      ]
    },
    {
      type: 'checkbox',
      name: 'uifeatures',
      message: 'Would you like more UI Features?',
      choices: [{
        value: 'options',
        name: 'Options Page',
        checked: false
      }, {
        value: 'contentscript',
        name: 'Content Scripts',
        checked: false
      }, {
        value: 'omnibox',
        name: 'Omnibox',
        checked: false
      }]
    },
    {
      type: 'checkbox',
      name: 'permissions',
      message: 'Would you like to use permissions?',
      choices: [{
        value: 'tabs',
        name: 'Tabs',
        checked: false
      }, {
        value: 'bookmark',
        name: 'Bookmarks',
        checked: false
      }, {
        value: 'cookie',
        name: 'Cookies',
        checked: false
      }, {
        value: 'history',
        name: 'History',
        checked: false
      }, {
        value: 'management',
        name: 'Management',
        checked: false
      }]
    }
  ];

  this.prompt( prompts , function(answers) {
    var isChecked = function (choices, value) { return choices.indexOf(value) > -1; };

    this.appname = this.manifest.name = answers.name.replace(/\"/g, '\\"');
    this.manifest.description = answers.description.replace(/\"/g, '\\"');
    this.manifest.action = (answers.action === 'No') ? 0 : (answers.action === 'Browser') ? 1 : 2;
    this.manifest.options = isChecked(answers.uifeatures, 'options');
    this.manifest.omnibox = isChecked(answers.uifeatures, 'omnibox');
    this.manifest.contentscript = isChecked(answers.uifeatures, 'contentscript');
    this.manifest.permissions.tabs = isChecked(answers.permissions, 'tabs');
    this.manifest.permissions.bookmarks = isChecked(answers.permissions, 'bookmarks');
    this.manifest.permissions.cookies = isChecked(answers.permissions, 'cookies');
    this.manifest.permissions.history = isChecked(answers.permissions, 'history');
    this.manifest.permissions.management = isChecked(answers.permissions, 'management');

    cb();
  }.bind(this));
};

ChromeExtensionGenerator.prototype.app = function app() {
  this.mkdir('app');
  this.mkdir('app/bower_components');
};

ChromeExtensionGenerator.prototype.gruntfile = function gruntfile() {
  this.template('Gruntfile.js');
};

ChromeExtensionGenerator.prototype.packageJSON = function packageJSON() {
  this.template('_package.json', 'package.json');
};

ChromeExtensionGenerator.prototype.git = function git() {
  this.copy('gitignore', '.gitignore');
  this.copy('gitattributes', '.gitattributes');
};

ChromeExtensionGenerator.prototype.bower = function bower() {
  this.copy('bowerrc', '.bowerrc');
  this.copy('_bower.json', 'bower.json');
};

ChromeExtensionGenerator.prototype.jshint = function jshint() {
  this.copy('jshintrc', '.jshintrc');
};

ChromeExtensionGenerator.prototype.editorConfig = function editorConfig() {
  this.copy('editorconfig', '.editorconfig');
};

ChromeExtensionGenerator.prototype.manifest = function manifest() {
  var manifest = {};
  var permissions = [];
  var items = [];

  // add browser / page action field
  if (this.manifest.action > 0) {
    var action = {
      default_icon: { 19: 'images/icon-19.png', 38: 'images/icon-38.png' },
      default_title: this.manifest.name,
      default_popup: 'popup.html'
    };
    var title = (this.manifest.action === 1) ? 'browser_action' : 'page_action';
    manifest[title] = JSON.stringify(action, null, 2).replace(/\n/g, '\n  ');
  }

  // add options page field.
  if (this.manifest.options) {
    manifest.options_page = '"options.html"';
  }

  // add omnibox keyword field.
  if (this.manifest.omnibox) {
    manifest.omnibox = JSON.stringify({ keyword: this.manifest.name }, null, 2).replace(/\n/g, '\n  ');
  }

  // add contentscript field.
  if (this.manifest.contentscript) {
    var contentscript = [{
      matches: ['http://*/*', 'https://*/*'],
      css: ['styles/main.css'],
      js: ['scripts/contentscript.js'],
      run_at: 'document_end',
      all_frames: false
    }];

    manifest.content_scripts = JSON.stringify(contentscript, null, 2).replace(/\n/g, '\n  ');
  }

  // add generate permission field.
  for (var p in this.manifest.permissions) {
    if (this.manifest.permissions[p]) {
      permissions.push(p);
    }
  }

  // add generic match pattern field.
  if (this.manifest.permissions.tabs) {
    permissions.push('http://*/*');
    permissions.push('https://*/*');
  }

  if (permissions.length > 0) {
    manifest.permissions = JSON.stringify(permissions, null, 2).replace(/\n/g, '\n  ');
  }

  for (var i in manifest) {
    items.push(['  "', i, '": ', manifest[i]].join(''));
  }

  this.manifest.items = (items.length > 0) ? ',\n' + items.join(',\n') : '';

  this.template('manifest.json', 'app/manifest.json');
};

ChromeExtensionGenerator.prototype.actions = function popup() {
  if (this.manifest.action === 0) {
    return;
  }

  this.copy('popup.html', 'app/popup.html');
  this.copyjs('popup');
  this.copy('images/icon-19.png', 'app/images/icon-19.png');
  this.copy('images/icon-38.png', 'app/images/icon-38.png');
};

ChromeExtensionGenerator.prototype.eventpage = function extensions() {
  var backgroundjs = 'background';

  if (this.manifest.action === 2) {
    backgroundjs = 'background.pageaction';
  } else if (this.manifest.action === 1) {
    backgroundjs = 'background.browseraction';
  }

  this.copyjs(backgroundjs, 'background');
  this.copyjs('chromereload');
};

ChromeExtensionGenerator.prototype.options = function options() {
  if (!this.manifest.options) {
    return;
  }

  this.copy('options.html', 'app/options.html');
  this.copyjs('options');
};

ChromeExtensionGenerator.prototype.contentscript = function contentscript() {
  if (!this.manifest.contentscript) {
    return;
  }

  this.copyjs('contentscript');
};

ChromeExtensionGenerator.prototype.mainStylesheet = function mainStylesheet() {
  if (this.manifest.action === 0 && !this.manifest.options) {
    return;
  }

  var css = 'styles/main.' + (this.compass ? 's' : '') + 'css';
  this.copy(css, 'app/' + css);
};

ChromeExtensionGenerator.prototype.assets = function assets() {
  this.template('_locales/en/messages.json', 'app/_locales/en/messages.json');
  this.copy('images/icon-16.png', 'app/images/icon-16.png');
  this.copy('images/icon-128.png', 'app/images/icon-128.png');
};

ChromeExtensionGenerator.prototype.install = function () {
  if (this.options['skip-install']) {
    return;
  }

  var done = this.async();
  this.installDependencies({
    skipMessage: this.options['skip-install-message'],
    skipInstall: this.options['skip-install'],
    callback: done
  });
}
