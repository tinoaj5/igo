/* site-patch.js — buttons + Google Places validation (CH) */
(function(){'use strict';
  var API_KEY = "AIzaSyDxiPfbUuLimnZa7MePEtAltu83ZDUugPs";

  // ---------- Dialog helpers ----------
  function supportsDialog(){ try{ return typeof HTMLDialogElement==='function' && !!document.createElement('dialog').showModal; }catch(_){return false;} }
  function openDlg(id){ var d=document.getElementById(id); if(!d) return;
    try{ if(supportsDialog()) d.showModal(); else { d.setAttribute('open',''); d.style.display='block'; } }catch(_){
      d.setAttribute('open',''); d.style.display='block';
    }
  }
  function closeDlg(id){ var d=document.getElementById(id); if(!d) return;
    try{ if(supportsDialog()) d.close(); else { d.removeAttribute('open'); d.style.display='none'; } }catch(_){}
  }

  // Expose globals so inline onclick="openOwner()" etc always work
  window.openOwner = function(){ openDlg('ownerModal'); ensurePlacesFor('owner'); setDateMinToday(); };
  window.closeOwner = function(){ closeDlg('ownerModal'); };
  window.openWalker = function(){ openDlg('walkerModal'); };
  window.closeWalker = function(){ closeDlg('walkerModal'); };
  window.openSignin = function(){ openDlg('signinModal'); };
  window.closeSignin = function(){ closeDlg('signinModal'); };
  window.openProfile = function(){ openDlg('profileModal'); ensurePlacesFor('profile'); };

  // Fallback: if buttons don't have onclick, wire them by label
  document.addEventListener('DOMContentLoaded', function(){
    Array.prototype.forEach.call(document.querySelectorAll('button'), function(btn){
      if (btn.getAttribute('onclick')) return;
      var t = (btn.textContent||'').toLowerCase();
      if (t.includes('book a walk')) btn.addEventListener('click', window.openOwner);
      else if (t.includes('become a walker')) btn.addEventListener('click', window.openWalker);
      else if (t.includes('sign in')) btn.addEventListener('click', window.openSignin);
    });
  });

  // ---------- Date: no past bookings ----------
  function setDateMinToday(){
    var el = document.getElementById('date_owner'); if(!el) return;
    var today = new Date(); today.setHours(0,0,0,0);
    el.min = today.toISOString().slice(0,10);
  }

  // ---------- Google Maps / Places ----------
  var mapsReady=false, mapsLoading=false, readyQ=[];
  function onMapsReady(cb){ if(mapsReady && window.google && google.maps && google.maps.places) cb(); else readyQ.push(cb); }
  function loadMaps(){
    if (mapsReady || mapsLoading) return;
    mapsLoading = true;
    var s=document.createElement('script');
    s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(API_KEY)+'&libraries=places&region=CH&language=en&callback=__mapsReady';
    s.async=true; s.defer=true;
    s.onerror=function(){ console.error('[site-patch] Maps failed to load'); alert('Google Maps failed to load. Check your key referrer restrictions.'); };
    document.head.appendChild(s);
  }
  window.__mapsReady = function(){
    mapsReady=true;
    while(readyQ.length) { try{ readyQ.shift()(); }catch(e){ console.warn(e); } }
  };

  var acMap={}; // inputId -> autocomplete
  function setHidden(id, val){ var el=document.getElementById(id); if(el) el.value = (val==null?'':val); }
  function attachAutocomplete(inputId, hidden){ 
    if (acMap[inputId]) return;
    var input = document.getElementById(inputId); if(!input) return;
    var ac = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: ['ch'] },
      fields: ['place_id','formatted_address','geometry','address_components','name']
    });
    ac.addListener('place_changed', function(){
      var place = ac.getPlace(); if(!place || !place.geometry) return;
      var comps = {};
      (place.address_components||[]).forEach(function(c){ (c.types||[]).forEach(function(t){ comps[t]=c.long_name; }); });
      setHidden(hidden.place_id, place.place_id||'');
      setHidden(hidden.lat, place.geometry.location.lat());
      setHidden(hidden.lng, place.geometry.location.lng());
      setHidden(hidden.formatted, place.formatted_address || place.name || input.value);
      setHidden(hidden.postal, comps.postal_code || '');
      setHidden(hidden.locality, comps.locality || comps.postal_town || comps.sublocality || '');
      setHidden(hidden.canton, comps.administrative_area_level_1 || '');
    });
    acMap[inputId]=ac;
    console.log('[site-patch] Autocomplete attached to #' + inputId);
  }

  function ensurePlacesFor(which){
    loadMaps();
    onMapsReady(function(){
      if (which==='owner') attachAutocomplete('address_owner', {
        place_id:'o_place_id', lat:'o_lat', lng:'o_lng',
        formatted:'o_formatted_address', postal:'o_postal_code',
        locality:'o_locality', canton:'o_canton'
      });
    });
    onMapsReady(function(){
      if (which==='profile') attachAutocomplete('address_profile', {
        place_id:'p_place_id', lat:'p_lat', lng:'p_lng',
        formatted:'p_formatted_address', postal:'p_postal_code',
        locality:'p_locality', canton:'p_canton'
      });
    });
  }

  // Always try to prep owner autocomplete early (in case form is visible)
  ensurePlacesFor('owner');

  // ---------- Form guards ----------
  document.addEventListener('submit', function(e){
    var form = e.target;
    if (!form) return;
    if (form.id === 'ownerForm') {
      var pid = (document.getElementById('o_place_id')||{}).value || '';
      if (!pid) { e.preventDefault(); alert('Please select an address from the Google dropdown.'); return; }
      var d = (document.getElementById('date_owner')||{}).value || '';
      var todayStr = new Date().toISOString().slice(0,10);
      if (!d || d < todayStr) { e.preventDefault(); alert("Date can't be in the past."); return; }
    }
    if (form.id === 'profileForm') {
      var ppid = (document.getElementById('p_place_id')||{}).value || '';
      if (!ppid) { e.preventDefault(); alert('Choose a valid address from the Google dropdown.'); return; }
    }
  });
})();