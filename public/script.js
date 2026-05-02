const sharedDate = window.__SHARED_DATE__;
const initialEndpoint = sharedDate ? '/epaper?date=' + encodeURIComponent(sharedDate) : '/latest';

fetch(initialEndpoint)
  .then(res => res.json())
  .then(data => {
    currentEpaper = data;
    showAllPages();
    if (sharedDate) {
      document.getElementById('datePicker').value = sharedDate;
    }
  })
  .catch(err => {
    console.error("Error loading latest epaper:", err);
    document.getElementById('viewer').innerHTML =
      "<h2 style='text-align:center;'>Error Loading Epaper</h2>";
  });

function showAllPages() {
  const viewer = document.getElementById('viewer');

  if (!currentEpaper) return;

  if (currentEpaper.images && currentEpaper.images.length > 0) {
    let pageButtons = '';
    for (let i = 0; i < currentEpaper.images.length; i++) {
      pageButtons += `<button onclick="scrollToPage(${i})">${i + 1}</button>`;
    }

    const imagesHtml = currentEpaper.images.map((img, index) => {
      const areas = currentEpaper.areas && currentEpaper.areas[index] ? currentEpaper.areas[index] : [];
      const mapHtml = areas.length > 0 ? `
        <map name="pageMap${index}">
          ${areas.map(area => `<area shape="rect" coords="${area.coords}" onclick="showNews('${area.newsId}')">`).join('')}
        </map>
      ` : '';
      return `<img id="page${index}" src="/uploads/${img}" class="pdf-page" alt="Page ${index + 1}" usemap="#pageMap${index}">${mapHtml}`;
    }).join('');

    viewer.innerHTML = `
      <div class="page-nav">
        <button onclick="scrollToPrev()">⬅️ Prev</button>
        ${pageButtons}
        <button onclick="scrollToNext()">Next ➡️</button>
      </div>
      ${imagesHtml}
    `;
  } else if (currentEpaper.pdf) {
    viewer.innerHTML = `
      <embed 
        src="/uploads/${currentEpaper.pdf}#toolbar=0&navpanes=0&view=fitV" 
        type="application/pdf" 
        width="100%" 
        height="100%">
    `;
  } else {
    viewer.innerHTML = "<h2 style='text-align:center;'>No Epaper Uploaded</h2>";
  }
}

function scrollToPage(pageIndex) {
  const element = document.getElementById('page' + pageIndex);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function scrollToPrev() {
  // Find current visible page, scroll to prev
  const pages = currentEpaper.images.length;
  for (let i = 0; i < pages; i++) {
    const element = document.getElementById('page' + i);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
        if (i > 0) {
          scrollToPage(i - 1);
        }
        return;
      }
    }
  }
  // If none, scroll to first
  scrollToPage(0);
}

function scrollToNext() {
  const pages = currentEpaper.images.length;
  for (let i = 0; i < pages; i++) {
    const element = document.getElementById('page' + i);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
        if (i < pages - 1) {
          scrollToPage(i + 1);
        }
        return;
      }
    }
  }
  // If none, scroll to last
  scrollToPage(pages - 1);
}

function showNews(newsId) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.8)';
  modal.style.zIndex = '1000';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.innerHTML = '<div style="background: white; padding: 20px; max-width: 90%; max-height: 90%; overflow-y: auto;"><button onclick="this.parentElement.parentElement.remove()" style="float: right;">Close</button><div id="newsContent"></div></div>';
  document.body.appendChild(modal);

  const content = modal.querySelector('#newsContent');
  const allAreas = [];
  for (let page in currentEpaper.areas) {
    currentEpaper.areas[page].forEach(area => {
      if (area.newsId === newsId) {
        allAreas.push({ ...area, page: parseInt(page) });
      }
    });
  }
  allAreas.sort((a, b) => a.part - b.part);

  allAreas.forEach(area => {
    const img = document.createElement('img');
    img.src = `/uploads/${currentEpaper.images[area.page]}`;
    img.style.maxWidth = '100%';
    img.onload = () => {
      const [left, top, right, bottom] = area.coords.split(',').map(Number);
      const clipTop = top;
      const clipRight = img.naturalWidth - right;
      const clipBottom = img.naturalHeight - bottom;
      const clipLeft = left;
      img.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
      img.style.margin = '10px 0';
    };
    content.appendChild(img);
  });
}

function loadDate(date) {
  if (!date) return;
  fetch('/epaper?date=' + encodeURIComponent(date))
    .then(res => res.json())
    .then(data => {
      if (data && !data.error) {
        currentEpaper = data;
        showAllPages();
        document.getElementById('datePicker').value = date; // keep selected
      } else if (data && data.error) {
        document.getElementById('viewer').innerHTML = '<h2 style="text-align: center; padding: 50px;">Server Error: ' + data.error + '</h2>';
      } else {
        document.getElementById('viewer').innerHTML = '<h2 style="text-align: center; padding: 50px;">No epaper found for the selected date</h2>';
        document.getElementById('datePicker').value = date;
      }
    })
    .catch(err => {
      console.error('Error loading date:', err);
      document.getElementById('viewer').innerHTML = '<h2 style="text-align: center; padding: 50px;">Error loading epaper</h2>';
    });
}

function loadToday() {
  fetch('/latest')
    .then(res => res.json())
    .then(data => {
      currentEpaper = data;
      showAllPages();
      document.getElementById('datePicker').value = ''; // clear
    })
    .catch(err => {
      console.error('Error loading latest:', err);
    });
}
