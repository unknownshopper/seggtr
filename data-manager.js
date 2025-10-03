// Funciones puras de manejo de datos
const DataManager = {
    KEY: 'encuestas',
    
    readAll() { 
      try { 
        return JSON.parse(localStorage.getItem(this.KEY) || '[]'); 
      } catch(e) { 
        return []; 
      } 
    },
    
    writeAll(arr) { 
      localStorage.setItem(this.KEY, JSON.stringify(arr)); 
    },
    
    toCSV(rows) { 
      if(!rows.length) return ''; 
      const headers = Object.keys(rows[0]); 
      const escape = v => `"${String(v??'').replace(/"/g,'""')}"`;
      return [
        headers.join(','),
        ...rows.map(r => headers.map(h => escape(r[h])).join(','))
      ].join('\n'); 
    },
    
    fromCSV(text) { 
      const [head,...lines] = text.split(/\r?\n/).filter(Boolean); 
      const headers = head.split(',').map(h => h.replace(/^\"|\"$/g,'')); 
      return lines.map(line => { 
        const cols = line.match(/\"(?:[^\"]|\"\")*\"|[^,]+/g) || []; 
        const values = cols.map(c => c.replace(/^\"|\"$/g,'').replace(/\"\"/g,'"')); 
        const obj = {}; 
        headers.forEach((h,i) => obj[h] = values[i] ?? ''); 
        return obj; 
      }); 
    }
  };