/*global jQuery */
/*!
 * jKerny.js
 * Version: 0.1
 * Copyright 2011 Olivier Gorzalka
 * CSS Parser adapted from JSS by Andy Kent
 * MIT license
 */

(function($) {

 /*
  * Lettering.JS 0.6.1
  *
  * Copyright 2010, Dave Rupert http://daverupert.com
  * Released under the WTFPL license
  * http://sam.zoy.org/wtfpl/
  *
  * Thanks to Paul Irish - http://paulirish.com - for the feedback.
  *
  * Date: Mon Sep 20 17:14:00 2010 -0600
  */
  function injector(t, splitter, klass, after) {
    var a = t.text().split(splitter), inject = '';
    if (a.length) {
      $(a).each(function(i, item) {
          inject += '<span class="'+klass+(i+1)+'">'+item+'</span>'+after;
      });
      t.empty().append(inject);
    }
  }

  var methods = {
    init: function() {
      return this.each(function() {
        injector($(this), '', 'char', '');
      });
    },

    words: function() {
      return this.each(function() {
        injector($(this), ' ', 'word', ' ');
      });
    },

    lines: function() {
      return this.each(function() {
        var r = "eefec303079ad17405c889e092e105b0";
        // Because it's hard to split a <br/> tag consistently across browsers,
        // (*ahem* IE *ahem*), we replaces all <br/> instances with an md5 hash
        // (of the word "split").  If you're trying to use this plugin on that
        // md5 hash string, it will fail because you're being ridiculous.
        injector($(this).children("br").replaceWith(r).end(), r, 'line', '');
      });
    }
  };

  $.fn.lettering = function(method) {
    // Method calling logic
    if (method && methods[method]) {
      return methods[method].apply(this, [].slice.call( arguments, 1 ));
    } else if (method === 'letters' || !method) {
      return methods.init.apply(this, [].slice.call( arguments, 0 )); // always pass an array
    }
    $.error('Method ' +  method + ' does not exist on jQuery.lettering');
    return this;
  };

  $.jkerny = {
    loadExternalStyles: true, // set to false to only analyse in document styles and avoid ajax requests. 
    exclude: [],
    lettering_replace : {
      ':letter' : 'span[class^=char]',
      ':word' : 'span[class^=word]',
      ':first-word' : 'span[class^=word]:first',
      ':last-word' : 'span[class^=word]:last',
      ':first-letter' : 'span[class^=char]:first',
      ':last-letter' : 'span[class^=char]:last'
    },
    only: [
      /span\[class\^=(word|char)\]/
    ], // only include selectors that match one these patterns
    
    disableCaching: false, // turn this on to disable caching
    
    checkMediaTypes: true, // set this to false if you want to always run all media types regardless of context.
    
    cache: {}, // used to cache selectors
    
    loadQueue: [], // tracks the load order of external sheets to make sure that styles are applied in the correct order
    completeQueue: [], // tacks which css files have been loaded
    
    media: {}, // a cache of media types and if they are supported in the current state
    
    testDiv: null, // used to test selector functionality. lazy loaded when needed. see mediumApplies()
    
    run: function(content) {
      var selectors = [];
      var jkerny = this;

      $('style,link[rel=stylesheet]').each(function() {
        if (jkerny.checkMediaTypes) { // media type support enabled
          if(!jkerny.mediumApplies(this.media)) return; // medium doesn't run in this context so ignore it entirely.
        }
        if(this.href) {
          if(jkerny.loadExternalStyles) {
            jkerny.loadQueue.push(this.href);
            jkerny.loadStylesFrom(this.href);
          };
        } else {
          content = jkerny.convertPseudoSelectors(this.innerHTML);
          selectors = selectors.concat(jkerny.parse(content));
          jkerny.proceedLettering(selectors);
        };
      });
      if(content) {
        selectors.concat(this.parse(content)); // parse any passed in styles
      }
      selectors = this.filterSelectors(selectors);
      this.runSelectors(selectors);
    },

    convertPseudoSelectors: function(content) {
      var jkerny = this;
      for (var key_letter in jkerny.lettering_replace) {
        content = content.replace(new RegExp(key_letter, 'g'), ' '+jkerny.lettering_replace[key_letter]);
      }
      return content;
    },
    
    loadStylesFrom: function(href) {
      var jkerny = this;
      $.ajax({
        url: href,
        success: function(data) {
          content = jkerny.convertPseudoSelectors(data);
          jkerny.refreshLoadQueue(href,content);
        }
      });
    }, 
    
    refreshLoadQueue: function(href,txt) {
      if(this.loadQueue.length==0) return; // everything in the queue is loaded
      if(href){ // a new sheet has been recieved
        if(href==this.loadQueue[0]) { // this sheet is next in the queue
          this.loadQueue.shift(); // move the queue on
          this.runStylesFromText(txt); // process this sheet
          this.refreshLoadQueue(); // recurse to see if any sheets are ready for loading.
        }
        else {
          this.completeQueue.push({href:href,txt:txt}); // not next so put aside for later
          this.refreshLoadQueue(); // recurse to see if any sheets are ready for loading.
        };
      } else { // no new sheet, lets see if the next load queue sheet matches anything in the completed queue
        if(this.completeQueue.length>0) {
          for(i in this.completeQueue) {
            var doc=this.completeQueue[i];
            if(doc.href==this.loadQueue[0]) { // we have a match
              this.loadQueue.shift(); // move the queue on
              this.completeQueue.splice(i,1); // clean up the completed queue
              this.runStylesFromText(doc.txt); // process this sheet
              this.refreshLoadQueue();
            };
          };
        };
      };
    },
    
    runStylesFromText: function(data){
      var jkerny = this;
      var selectors = this.filterSelectors(this.parse(data));
      this.runSelectors(selectors);
      jkerny.proceedLettering(selectors);
    },

    proceedLettering: function(selectors) {
      $.each(selectors, function(){
        var $elements = $(this.selector.split(/ span\[class\^=(char|word)\]/g)[0]);
        $elements
            .not('.kerningjs')
            .addClass('kerningjs').css('visibility', 'inherit')
            .lettering('words').children('span').css('display', 'inline-block') // break down into words
            .lettering().children('span').css('display', 'inline-block'); // break down into letters
        $(this.selector).css(this.attributes);
      });
    },
    
    runSelectors: function(selectors) {
      var jkerny = this;
      var result = null;
      $.each(selectors, function(){ // load each of the matched selectors
        if(jkerny.isUnderstoodSelector(this.selector)) return; // skip runing the selector if the browser already understands it.
        if(jkerny.disableCaching) return $(this.selector).css(this.attributes); // cache is turned off so just run styles
        if(jkerny.cache[this.selector]){ // check the cache
          jkerny.cache[this.selector].css(this.attributes); // direct cache hit
        } else if( result=jkerny.scanCache(this.selector) ) {
          result[0].find(result[1]).css(this.attributes); // partial cache hit
        } else {
          jkerny.cache[this.selector] = $(this.selector).css(this.attributes); // cache miss
        };
      });
    },
    
    scanCache: function(selector) {
      for(var s in this.cache) {
        if(selector.search(new RegExp('^'+s+'[ >]'))>-1)
          return [ this.cache[s], selector.replace(new RegExp('^'+s+'[ >]'),'') ];
      };
    },
    
    filterSelectors: function(selectors){
      if(!selectors.length) return [];
      var s = selectors;
      if(this.only && this.only.length) { // filter selectors to remove those that don't match the only include rules
        var inclusions = this.only;
        var t=[]; // temp store for matches
        for(var i=0;i<inclusions.length;i++){
          for(var pos=0;pos<s.length;pos++){
            if( typeof inclusions[i]=='string' ? s[pos].selector==inclusions[i] : s[pos].selector.match(inclusions[i]) ) {
              t.push(s[pos]);
            };
          };
        };
        s=t;
      };
      if(this.exclude && this.exclude.length){ // filter selectors to remove those that match the exclusion rules
        var exclusions = this.exclude;
        for(var i=0;i<exclusions.length;i++){
          for(var pos=0;pos<s.length;pos++){
            if( typeof exclusions[i]=='string' ? s[pos].selector==exclusions[i] : s[pos].selector.match(exclusions[i]) ) {
              s.splice(pos,1);
              pos--;
            };
          };
        };
      };
      return s;
    },
    
    
    // ---
    // Some magic for checking if a selector is understood by the browser - Thanks go to Daniel Wachsstock <d.wachss@prodigy.net>
    // --
    
    isUnderstoodSelector: function(str){
       var ret;
       str += '{}'; // make a rule out of it
       // Things like this make us crazy:
       // Safari only creates the stylesheet if there is some text in the style element,
       // while Opera crashes if the original statement has any text [as $('<style> </style>') ].
       // IE crashes if we try to append a text node to a style element.
       // The following satisfies all of them
       var style = $('<style type="text/css"/>').appendTo('head')[0];
       try {
         style.appendChild(document.createTextNode(''));
       }catch(e){ /* nothing */ }
       if (style.styleSheet){
         // IE freezes up if addRule gets a selector it doesn't understand, but parses cssText fine and turns it to UNKNOWN
         style.styleSheet.cssText = str;
         ret =  !/UNKNOWN/i.test(style.styleSheet.cssText);
       }else if (style.sheet){
         // standards
         try {
           style.sheet.insertRule(str, 0);
           ret = style.sheet.cssRules.length > 0; // the browser accepted it; now see if it stuck (Opera gets here)
         }catch(e) {
           ret = false; // browser couldn't handle it
         }
       }
       $(style).remove();
       return ret;
     }, 
    
    
    // ---
    // A test to see if a particular media type should be applied
    // ---
    
    mediumApplies: function(str){
       if (!str) return true; // if no descriptor, everything applies
       if (str in this.media) return this.media[str]; // cache
       if (!this.testDiv){
         this.testDiv = $('<div id="mediaTestDiv" style="position:relative">').append('<div>').appendTo('body'); // lazy create
       };
       var style = $('<style type="text/css" media="'+str+'" />').appendTo('head')[0];
       try {
         style.appendChild(document.createTextNode(''));
       }catch(e){ /* nothing */ }
       if (style.styleSheet){
         // IE
         style.styleSheet.addRule('#mediaTestDiv', 'left: 1px');
       }else if (style.sheet){
         // standards
         style.sheet.insertRule('#mediaTestDiv {left: 1px}', 0);
       }
       this.media[str] = this.testDiv.css('left') == '1px';
       $(style).remove();
       return this.media[str];
     },
    
    
    // ---
    // ultra lightweight CSS parser, only works with 100% valid css files, no support for hacks etc.
    // ---
    
    sanitize: function(content) {
      if(!content) return '';
      var c = content.replace(/[\n\r]/gi,''); // remove newlines
      c = c.replace(/\/\*.+?\*\//gi,''); // remove comments
      return c;
    },
    
    parse: function(content){
      var c = this.sanitize(content);
      var tree = []; // this is the css tree that is built up
      c = c.match(/.+?\{.+?\}/gi); // seperate out selectors
      if(!c) return [];
      for(var i=0;i<c.length;i++) // loop through the selectors & parse the attributes
        if(c[i]) 
          tree.push( { selector: this.parseSelectorName(c[i]),  attributes: this.parseAttributes(c[i]) } );
      return tree;
    },
    
    parseSelectorName: function(content){
      return $.trim(content.match(/^.+?\{/)[0].replace('{','')); // extract the selector
    },

    parseAttributes: function(content){
      var attributes = {};
      c = content.match(/\{.+?\}/)[0].replace(/[\{\}]/g,'').split(';').slice(0,-1);
      for(var i=0;i<c.length; i++){
        if(c[i]){
          c[i] = c[i].split(':');
          attributes[$.trim(c[i][0])] = $.trim(c[i][1]);
        }; 
      };
      return attributes;
    }
    
  };

})(jQuery);

$(document).ready(function() {
  $.jkerny.run();
});