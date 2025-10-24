(function(){
  const fmt = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long', timeStyle: 'short'
  });
  const now = new Date();
  const lastUpdatedEl = document.getElementById('lastUpdated');
  const yearEl = document.getElementById('currentYear');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Última actualización: ${fmt.format(now)}`;
  }
  if (yearEl) {
    yearEl.textContent = String(now.getFullYear());
  }
})();