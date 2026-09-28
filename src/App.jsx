import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Type, User, AlignLeft, LayoutTemplate, Sparkles, BookOpen, Layers, FileText, Plus, Trash2, ZoomIn, ZoomOut, Maximize, Image } from 'lucide-react';
import './App.css';

function App() {
  const [template, setTemplate] = useState('classic');
  const [isExporting, setIsExporting] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [pageSize, setPageSize] = useState('a4'); // a4, a5, letter
  const [zoom, setZoom] = useState(70); // default zoom
  const [editingPageId, setEditingPageId] = useState(null);
  const [isGlobalLayout, setIsGlobalLayout] = useState(false);
  const [brandingName, setBrandingName] = useState('');
  const [brandingLink, setBrandingLink] = useState('');

  // Drag and Pan State
  const previewRef = React.useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const [draggingElement, setDraggingElement] = useState(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 20));
  const handleZoomReset = () => setZoom(70);

  // Maintain array of all added pages
  const [pages, setPages] = useState([]);
  
  const [draftPage, setDraftPage] = useState({
    type: 'cover',
    title: 'The Enchanted Forest',
    subtitle: 'A Tale of Magic and Mystery',
    author: 'Jane Austen',
    content: 'The cold winds howled through the ancient trees, their branches twisting like skeletal fingers against the twilight sky. Elara pulled her cloak tighter, her heart pounding a steady rhythm against her ribs.\n\nShe had been warned about the Whispering Woods, but the map in her trembling hands left no room for doubt. The artifact lay hidden somewhere in its depths.',
    image: ''
  });

  const PAGE_TYPES = [
    { id: 'cover', label: 'Title / Cover Page' },
    { id: 'copyright', label: 'Copyright Page' },
    { id: 'preface', label: 'Preface / Introduction' },
    { id: 'toc', label: 'Table of Contents' },
    { id: 'chapter', label: 'Chapter Opening' },
    { id: 'content', label: 'Normal Content Page' },
    { id: 'twocolumn', label: 'Two-Column Page' },
    { id: 'exam', label: 'Two-Column Exam / MCQ' },
    { id: 'question', label: 'Question Bank Page' },
    { id: 'mcq', label: 'MCQ Page' },
    { id: 'notes', label: 'Notes Page' },
    { id: 'imagetext', label: 'Image + Text Page' },
    { id: 'backcover', label: 'Back Cover' },
  ];

  const handleUpdateDraft = (field, value) => {
    setDraftPage(prev => ({ ...prev, [field]: value }));
    if (editingPageId) {
      setPages(currPages => currPages.map(p => p.id === editingPageId ? { ...p, [field]: value } : p));
    }
  };

  const handleDirectEdit = (pageId, field, value) => {
    setPages(currPages => currPages.map(p => p.id === pageId ? { ...p, [field]: value } : p));
    if (editingPageId === pageId) {
      setDraftPage(prev => ({ ...prev, [field]: value }));
    }
  };

  const chunkText = (text, maxChars, type) => {
    const chunks = [];
    let textToProcess = text;
    while (textToProcess.length > 0) {
      if (textToProcess.length <= maxChars) {
        chunks.push(textToProcess);
        break;
      }
      let breakPoint = -1;
      if (['exam', 'question', 'mcq'].includes(type)) {
        const regex = /\n\s*\d+[\.\)]/g;
        let match;
        while ((match = regex.exec(textToProcess)) !== null) {
          if (match.index > 0 && match.index <= maxChars) {
            breakPoint = match.index;
          }
          if (match.index > maxChars) break;
        }
      }
      if (breakPoint === -1 || breakPoint < maxChars * 0.2) breakPoint = textToProcess.lastIndexOf('\n\n', maxChars);
      if (breakPoint === -1 || breakPoint < maxChars * 0.2) breakPoint = textToProcess.lastIndexOf('\n', maxChars);
      if (breakPoint === -1 || breakPoint < maxChars * 0.2) breakPoint = textToProcess.lastIndexOf(' ', maxChars);
      if (breakPoint === -1) breakPoint = maxChars;
      
      chunks.push(textToProcess.substring(0, breakPoint).trim());
      textToProcess = textToProcess.substring(breakPoint).trim();
    }
    return chunks;
  };

  // Auto-paginate when editing after typing pauses
  useEffect(() => {
    if (!editingPageId) return;

    const timer = setTimeout(() => {
      const charsPerPageMap = { micro: 6000, tiny: 4500, small: 3300, medium: 2200, large: 1350 };
      const sizeMultiplierMap = { a4: 1.0, a5: 0.5, letter: 0.95 };
      let MAX_CHARS_PER_PAGE = charsPerPageMap[fontSize] * sizeMultiplierMap[pageSize]; 
      
      if (draftPage.type === 'exam') {
        MAX_CHARS_PER_PAGE *= 0.28; // Heavily padded two-column blocks, unbreakable
      } else if (draftPage.type === 'twocolumn') {
        MAX_CHARS_PER_PAGE *= 0.55;
      } else if (['question', 'mcq'].includes(draftPage.type)) {
        MAX_CHARS_PER_PAGE *= 0.45; // Padded single-column blocks
      }
      
      const paginatableTypes = ['content', 'twocolumn', 'exam', 'question', 'mcq', 'preface', 'imagetext', 'notes'];

      if (paginatableTypes.includes(draftPage.type) && draftPage.content && draftPage.content.length > MAX_CHARS_PER_PAGE) {
         const chunks = chunkText(draftPage.content, MAX_CHARS_PER_PAGE, draftPage.type);
         
         if (chunks.length > 1) {
           const newPagesToAdd = chunks.map((chunk, index) => ({
             ...draftPage,
             id: index === 0 ? editingPageId : (Date.now() + index),
             title: index === 0 ? draftPage.title : '',
             image: index === 0 ? draftPage.image : '',
             content: chunk
           }));

           setPages(prev => {
             const idx = prev.findIndex(p => p.id === editingPageId);
             if (idx === -1) return prev;
             const newArr = [...prev];
             newArr.splice(idx, 1, ...newPagesToAdd);
             return newArr;
           });

           // Keep them editing chunk 1, effectively slicing the text in the textarea
           setDraftPage(prev => ({ ...prev, content: chunks[0] }));
         }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPage.content, draftPage.type, editingPageId, fontSize, pageSize]);

  const handleAddPage = () => {
    const charsPerPageMap = { micro: 6000, tiny: 4500, small: 3300, medium: 2200, large: 1350 };
    const sizeMultiplierMap = { a4: 1.0, a5: 0.5, letter: 0.95 };
    let MAX_CHARS_PER_PAGE = charsPerPageMap[fontSize] * sizeMultiplierMap[pageSize]; 
    if (draftPage.type === 'exam') MAX_CHARS_PER_PAGE *= 0.28;
    else if (draftPage.type === 'twocolumn') MAX_CHARS_PER_PAGE *= 0.55;
    else if (['question', 'mcq'].includes(draftPage.type)) MAX_CHARS_PER_PAGE *= 0.45;

    const paginatableTypes = ['content', 'twocolumn', 'exam', 'question', 'mcq', 'preface', 'imagetext', 'notes'];
    let newPagesToAdd = [];

    if (paginatableTypes.includes(draftPage.type) && draftPage.content && draftPage.content.length > MAX_CHARS_PER_PAGE) {
      const chunks = chunkText(draftPage.content, MAX_CHARS_PER_PAGE, draftPage.type);
      newPagesToAdd = chunks.map((chunk, index) => ({
        ...draftPage,
        id: Date.now() + index,
        title: index === 0 ? draftPage.title : '',
        image: index === 0 ? draftPage.image : '',
        content: chunk
      }));
    } else {
      newPagesToAdd = [{ ...draftPage, id: Date.now() }];
    }

    setPages(prev => [...prev, ...newPagesToAdd]);
    setDraftPage(prev => ({ type: isGlobalLayout ? prev.type : 'content', title: '', content: '' }));
  };

  const handleInsertPageAfter = (index) => {
    const newPage = { id: Date.now(), type: draftPage.type, title: '', content: '' };
    setPages(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newPage);
      return updated;
    });
    setEditingPageId(newPage.id);
    setDraftPage(newPage);
  };

  const handleDeletePage = (id) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    // Allow UI to update and remove scaling before capturing
    await new Promise(resolve => setTimeout(resolve, 500));

    const elements = document.querySelectorAll('.pdf-page-element');
    if (elements.length === 0) {
      alert("Please add at least one page to the book before exporting!");
      setIsExporting(false);
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: pageSize === 'a5' ? 'a5' : (pageSize === 'letter' ? 'letter' : 'a4')
      });

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const canvas = await html2canvas(el, {
          scale: 2, // High resolution
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Map the HTML link into the PDF coordinates so it's clickable in the exported file!
        const brandingLinkElement = el.querySelector('.branding-link');
        if (brandingLinkElement) {
          const pageRect = el.getBoundingClientRect();
          const linkRect = brandingLinkElement.getBoundingClientRect();
          const scaleX = pdfWidth / pageRect.width;
          const scaleY = pdfHeight / pageRect.height;
          const x = (linkRect.left - pageRect.left) * scaleX;
          const y = (linkRect.top - pageRect.top) * scaleY;
          const w = linkRect.width * scaleX;
          const h = linkRect.height * scaleY;
          
          pdf.link(x, y, w, h, { url: brandingLinkElement.href });
        }
      }
      
      pdf.save('Document.pdf');
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("An error occurred: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Drag Handlers
  const handleElementMouseDown = (e, pageId, elementType, elementId = null) => {
    e.stopPropagation();
    e.preventDefault();
    const page = pages.find(p => p.id === pageId) || (draftPage.id === pageId || editingPageId === pageId ? draftPage : null);
    if (!page) return;

    if (elementType === 'image-resize') {
      setDraggingElement({
        pageId,
        elementType,
        startX: e.clientX,
        initialSize: page.imageWidth || 300
      });
      return;
    }
    
    if (elementType === 'text-resize') {
      const ft = (page.floatingTexts || []).find(f => f.id === elementId);
      if (!ft) return;
      setDraggingElement({
        pageId,
        elementType,
        elementId,
        startX: e.clientX,
        initialSize: ft.size || 18
      });
      return;
    }

    if (elementType === 'text') {
      const ft = (page.floatingTexts || []).find(f => f.id === elementId);
      if (!ft) return;
      setDraggingElement({
        pageId,
        elementType,
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        initialX: ft.x || 50,
        initialY: ft.y || 50
      });
      return;
    }

    setDraggingElement({
      pageId,
      elementType, // 'image'
      startX: e.clientX,
      startY: e.clientY,
      initialX: page.imageX || 50,
      initialY: page.imageY || 50
    });
  };

  const handleMouseDown = (e) => {
    // Ignore drags that start on buttons, inputs, or links
    if (['button', 'input', 'textarea', 'select', 'a'].includes(e.target.tagName.toLowerCase()) || e.target.closest('a')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      x: previewRef.current.scrollLeft,
      y: previewRef.current.scrollTop
    });
  };

  const handleMouseMove = (e) => {
    if (draggingElement) {
      e.preventDefault();
      
      const dx = (e.clientX - draggingElement.startX) / (zoom / 100);
      
      if (draggingElement.elementType.endsWith('-resize')) {
        const isImage = draggingElement.elementType === 'image-resize';
        const newSize = isImage 
           ? Math.max(50, Math.min(1200, draggingElement.initialSize + dx))
           : Math.max(10, Math.min(200, draggingElement.initialSize + dx / 2));
           
        if (isImage) {
          if (editingPageId === draggingElement.pageId || (!editingPageId && pages.length === 0)) {
            handleUpdateDraft('imageWidth', newSize);
          } else {
            setPages(prev => prev.map(p => p.id === draggingElement.pageId ? { ...p, imageWidth: newSize } : p));
            if (editingPageId === draggingElement.pageId) {
              setDraftPage(prev => ({ ...prev, imageWidth: newSize }));
            }
          }
        } else {
          // Update specific floating text size in array
          const updateTexts = (p) => ({
            ...p,
            floatingTexts: (p.floatingTexts || []).map(ft => ft.id === draggingElement.elementId ? { ...ft, size: newSize } : ft)
          });
          if (editingPageId === draggingElement.pageId || (!editingPageId && pages.length === 0)) {
            setDraftPage(prev => updateTexts(prev));
          } else {
            setPages(prev => prev.map(p => p.id === draggingElement.pageId ? updateTexts(p) : p));
            if (editingPageId === draggingElement.pageId) {
              setDraftPage(prev => updateTexts(prev));
            }
          }
        }
        return;
      }
      
      const dy = (e.clientY - draggingElement.startY) / (zoom / 100);
      const newX = draggingElement.initialX + dx;
      const newY = draggingElement.initialY + dy;
      
      if (draggingElement.elementType === 'image') {
        if (editingPageId === draggingElement.pageId || (!editingPageId && pages.length === 0)) {
          handleUpdateDraft('imageX', newX);
          handleUpdateDraft('imageY', newY);
        } else {
          setPages(prev => prev.map(p => p.id === draggingElement.pageId ? { ...p, imageX: newX, imageY: newY } : p));
          if (editingPageId === draggingElement.pageId) {
            setDraftPage(prev => ({ ...prev, imageX: newX, imageY: newY }));
          }
        }
      } else {
        // Update specific floating text position in array
        const updateTexts = (p) => ({
          ...p,
          floatingTexts: (p.floatingTexts || []).map(ft => ft.id === draggingElement.elementId ? { ...ft, x: newX, y: newY } : ft)
        });
        if (editingPageId === draggingElement.pageId || (!editingPageId && pages.length === 0)) {
          setDraftPage(prev => updateTexts(prev));
        } else {
          setPages(prev => prev.map(p => p.id === draggingElement.pageId ? updateTexts(p) : p));
          if (editingPageId === draggingElement.pageId) {
            setDraftPage(prev => updateTexts(prev));
          }
        }
      }
      return;
    }

    if (!isDragging) return;
    e.preventDefault(); // Prevents text selection while dragging
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    previewRef.current.scrollLeft = scrollStart.x - dx;
    previewRef.current.scrollTop = scrollStart.y - dy;
  };

  const handleMouseUp = () => {
    setDraggingElement(null);
    setIsDragging(false);
  };
  const handleMouseLeave = () => {
    setDraggingElement(null);
    setIsDragging(false);
  };

  const handleEditPage = (page) => {
    if (isDragging || isExporting) return;
    if (editingPageId === page.id) return; // Already editing this page

    setEditingPageId(page.id);
    setDraftPage({ ...page });
  };

  // Helper to automatically wrap question numbers in .q-num and .mcq-question for beautiful styling
  const parseQuestionNumbers = (text) => {
    if (typeof text !== 'string') return text;
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const match = line.match(/^(\s*\d+[\.\)])(.*)/);
      if (match) {
        return (
          <div key={i} className="mcq-question">
            <span className="q-num">{match[1]}</span>{match[2]}
          </div>
        );
      }
      return (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 ? '\n' : ''}
        </React.Fragment>
      );
    });
  };

  // Helper function to get font size style based on user selection
  const getFontSizeStyle = () => {
    if (fontSize === 'micro') return { fontSize: '0.65rem' };
    if (fontSize === 'tiny') return { fontSize: '0.75rem' };
    if (fontSize === 'small') return { fontSize: '0.9rem' };
    if (fontSize === 'large') return { fontSize: '1.4rem' };
    return {};
  };

  // Helper component to render a page
  const RenderPage = ({ page, index, isDraft = false }) => (
    <div 
      className={`page-wrapper ${!isDraft && editingPageId === page.id ? 'editing-active' : ''}`}
      onClick={() => {
        if (!isDraft) handleEditPage(page);
      }}
      onMouseEnter={() => {
        if (!isDraft) handleEditPage(page);
      }}
      style={{ 
        position: 'relative',
        height: isExporting ? 'var(--page-height)' : `calc(var(--page-height) * ${zoom / 100})`,
        width: isExporting ? 'var(--page-width)' : `calc(var(--page-width) * ${zoom / 100})`,
        transition: 'width 0.2s, height 0.2s',
        margin: '0 auto'
      }}
    >
      {/* Remove button (only for added pages) */}
      {!isDraft && !isExporting && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
          className="btn-danger"
          style={{ position: 'absolute', top: -15, right: -15, zIndex: 10, padding: 8, borderRadius: '50%' }}
          title="Remove Page"
        >
          <Trash2 size={16} />
        </button>
      )}

      {/* The actual page */}
      <div 
        className={`page-container page-size-${pageSize} template-${template} page-${page.type} ${!isDraft ? 'pdf-page-element page-clickable' : ''}`}
        style={{ 
          opacity: isDraft && pages.length > 0 ? 0.7 : 1, 
          border: isDraft && pages.length > 0 ? '2px dashed var(--primary)' : 'none',
          transform: isExporting ? 'none' : `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          transition: 'transform 0.2s'
        }}
      >
        {isDraft && pages.length > 0 && (
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 'bold' }}>
            DRAFT PREVIEW
          </div>
        )}
        
        {page.type === 'cover' && template === 'polity' ? (
          <div className="page-inner-cover polity-cover">
            <div 
              className="polity-cover-top"
              contentEditable={true} suppressContentEditableWarning={true}
              onBlur={e => handleDirectEdit(page.id, 'polityTop', e.target.innerText)}
            >
              {page.polityTop || "A COMPREHENSIVE GUIDE TO"}
            </div>
            <h1>
              <span 
                className="title-part-1"
                contentEditable={true} suppressContentEditableWarning={true}
                onBlur={e => handleDirectEdit(page.id, 'polityTitle1', e.target.innerText)}
              >
                {page.polityTitle1 || (page.title || 'INDIAN POLITY').split(' ')[0]}
              </span>
              <br/>
              <span 
                className="title-part-2"
                contentEditable={true} suppressContentEditableWarning={true}
                onBlur={e => handleDirectEdit(page.id, 'polityTitle2', e.target.innerText)}
              >
                {page.polityTitle2 || (page.title || 'INDIAN POLITY').split(' ').slice(1).join(' ')}
              </span>
            </h1>
            
            {page.subtitle && (
              <h2
                contentEditable={true} suppressContentEditableWarning={true}
                onBlur={e => handleDirectEdit(page.id, 'subtitle', e.target.innerText)}
              >
                {page.subtitle}
              </h2>
            )}
            
            <div className="polity-features">
              <div className="feature-item">
                <div className="feature-icon">📖</div>
                <span contentEditable={true} suppressContentEditableWarning={true} onBlur={e => handleDirectEdit(page.id, 'polityF1', e.target.innerText)}>
                  {page.polityF1 || "Conceptual Explanation"}
                </span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📝</div>
                <span contentEditable={true} suppressContentEditableWarning={true} onBlur={e => handleDirectEdit(page.id, 'polityF2', e.target.innerText)}>
                  {page.polityF2 || "PYQs Covered"}
                </span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">💡</div>
                <span contentEditable={true} suppressContentEditableWarning={true} onBlur={e => handleDirectEdit(page.id, 'polityF3', e.target.innerText)}>
                  {page.polityF3 || "Exam-Oriented Notes"}
                </span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <span contentEditable={true} suppressContentEditableWarning={true} onBlur={e => handleDirectEdit(page.id, 'polityF4', e.target.innerText)}>
                  {page.polityF4 || "Practice Questions"}
                </span>
              </div>
            </div>

            <div className="polity-illustration">
              🏛️
            </div>

            <div className="polity-footer-ribbon">
              <h3
                contentEditable={true} suppressContentEditableWarning={true}
                onBlur={e => handleDirectEdit(page.id, 'author', e.target.innerText)}
              >
                {page.author || '"A Strong Democracy Builds a Stronger India"'}
              </h3>
              <div 
                className="polity-exams"
                contentEditable={true} suppressContentEditableWarning={true}
                onBlur={e => handleDirectEdit(page.id, 'polityExams', e.target.innerText)}
              >
                {page.polityExams || "UPSC CSE • State PCS • SSC • Railways"}
              </div>
            </div>
          </div>
        ) : page.type === 'cover' && (
          <div className="page-inner-cover">
            <h1>{page.title}</h1>
            {page.subtitle && <h2>{page.subtitle}</h2>}
            <h3>{page.author}</h3>
          </div>
        )}
        
        {page.type === 'copyright' && (
          <div className="page-inner-copyright">
            <h4>© {page.subtitle} {page.author}</h4>
            <h5>Published by {page.title}</h5>
            <div className="content-body" style={{ fontSize: fontSize === 'tiny' ? '0.7rem' : (fontSize === 'small' ? '0.8rem' : '0.9rem') }}>{page.content}</div>
          </div>
        )}

        {page.type === 'preface' && (
          <div className="page-inner-preface">
            <h2 className="preface-title">{page.title || 'Preface'}</h2>
            <div className="content-body" style={getFontSizeStyle()}>{page.content}</div>
          </div>
        )}

        {page.type === 'toc' && (
          <div className="page-inner-toc">
            <h2 className="toc-title">{page.title || 'Table of Contents'}</h2>
            {pages.some(p => p.type === 'chapter') ? (
              <div className="toc-list">
                {pages.map((p, i) => {
                  if (p.type === 'chapter') {
                    return (
                      <div key={p.id} className="toc-item">
                        <span className="toc-chapter-title">{p.subtitle ? `${p.subtitle}: ` : ''}{p.title || 'Untitled Chapter'}</span>
                        <span className="toc-dots"></span>
                        <span className="toc-page-num">{i + 1}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ) : (
              <div className="content-body toc-body" style={getFontSizeStyle()}>
                {page.content || 'Add Chapter pages to your book to automatically generate the Table of Contents here.'}
              </div>
            )}
          </div>
        )}

        {page.type === 'chapter' && (
          <div className="page-inner-chapter">
            {page.subtitle && <h3 className="chapter-number">{page.subtitle}</h3>}
            <h1 className="chapter-title">{page.title}</h1>
          </div>
        )}

        {page.type === 'content' && (
          <div className="page-inner-content">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body" style={getFontSizeStyle()}>
              {page.content}
            </div>
          </div>
        )}

        {page.type === 'twocolumn' && (
          <div className="page-inner-twocolumn">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body two-column" style={getFontSizeStyle()}>
              {page.content}
            </div>
          </div>
        )}

        {page.type === 'exam' && (
          <div className="page-inner-exam">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body exam-body" style={getFontSizeStyle()}>
              {(page.content || '').split(/(?=\n\s*\d+[\.\)])/).map((block, i) => {
                if (!block.trim()) return null;
                
                // Split the block to find the "Answer:" section
                const parts = block.trim().split(/(?=^Answer:|^Ans:|\nAnswer:|\nAns:)/i);

                return (
                  <div key={i} className="exam-block">
                    {parts.map((part, pIdx) => {
                      if (part.trim().toLowerCase().startsWith('answer:') || part.trim().toLowerCase().startsWith('ans:')) {
                        return (
                          <div key={pIdx} className="exam-answer-highlight">
                            {part.trim()}
                          </div>
                        );
                      }
                      return <span key={pIdx}>{parseQuestionNumbers(part)}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {page.type === 'question' && (
          <div className="page-inner-question">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body question-body" style={getFontSizeStyle()}>
              {parseQuestionNumbers(page.content)}
            </div>
          </div>
        )}

        {page.type === 'mcq' && (
          <div className="page-inner-mcq">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body mcq-body" style={getFontSizeStyle()}>
              {parseQuestionNumbers(page.content)}
            </div>
          </div>
        )}

        {page.type === 'notes' && (
          <div className="page-inner-notes">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body notes-body" style={getFontSizeStyle()}>
              {page.content}
            </div>
          </div>
        )}

        {page.type === 'imagetext' && (
          <div className="page-inner-imagetext">
            {page.title && <div className="content-title">{page.title}</div>}
            <div className="content-body" style={getFontSizeStyle()}>
              {page.content}
            </div>
          </div>
        )}

        {page.type === 'backcover' && (
          <div className="page-inner-backcover">
            <h1>{page.title}</h1>
            <div className="content-body" style={getFontSizeStyle()}>{page.content}</div>
          </div>
        )}

        {/* Universal Floating Image rendered for ALL pages */}
        {page.image && (
          <div 
            className="floating-element-container"
            style={{ 
              position: 'absolute', 
              left: page.imageX || 50, 
              top: page.imageY || 50, 
              zIndex: 10
            }}
          >
            <img 
              src={page.image} 
              alt="Page Visual" 
              style={{ 
                cursor: 'grab',
                width: page.imageWidth ? `${page.imageWidth}px` : 'auto',
                maxWidth: page.imageWidth ? 'none' : '80%',
                objectFit: 'contain'
              }}
              onMouseDown={(e) => handleElementMouseDown(e, page.id || draftPage.id, 'image')}
              onDragStart={(e) => e.preventDefault()}
            />
            {!isExporting && (
              <div 
                className="resize-handle"
                onMouseDown={(e) => handleElementMouseDown(e, page.id || draftPage.id, 'image-resize')}
              />
            )}
          </div>
        )}

        {/* Universal Floating Text rendered for ALL pages */}
        {(page.floatingTexts || []).map((ft) => (
          <div 
            key={ft.id}
            className="floating-element-container"
            style={{ 
              position: 'absolute', 
              left: ft.x || 50, 
              top: ft.y || 150, 
              zIndex: 11
            }}
          >
            <div 
              style={{ 
                cursor: 'grab',
                fontFamily: 'Inter, sans-serif',
                fontSize: ft.size ? `${ft.size}px` : (fontSize === 'small' ? '0.9rem' : (fontSize === 'medium' ? '1.1rem' : '1.4rem')),
                color: '#1a365d',
                fontWeight: 600,
                whiteSpace: 'pre-wrap',
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px dashed transparent',
                transition: 'border 0.2s'
              }}
              onMouseDown={(e) => handleElementMouseDown(e, page.id || draftPage.id, 'text', ft.id)}
              onMouseOver={(e) => e.target.style.border = '1px dashed #6366f1'}
              onMouseOut={(e) => e.target.style.border = '1px dashed transparent'}
            >
              {ft.text}
            </div>
            {!isExporting && (
              <div 
                className="resize-handle"
                onMouseDown={(e) => handleElementMouseDown(e, page.id || draftPage.id, 'text-resize', ft.id)}
              />
            )}
          </div>
        ))}

        {/* Footer Area (Branding & Page Number) */}
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '40px',
          right: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: '#666',
          fontFamily: 'inherit'
        }}>
          {/* Centered Branding */}
          {brandingName && (
            <div style={{ textAlign: 'center' }}>
              {brandingLink ? (
                <a 
                  className="branding-link"
                  href={brandingLink.startsWith('http') ? brandingLink : `https://${brandingLink}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  {brandingName}
                </a>
              ) : (
                <span>{brandingName}</span>
              )}
            </div>
          )}
          
          {/* Page Number in Corner */}
          <div style={{ position: 'absolute', right: 0 }}>
            {index + 1}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app-container page-size-${pageSize}`}>
      {/* Sidebar Controls */}
      <div className="sidebar">
        <div className="sidebar-header">
          <BookOpen className="icon-gradient" size={28} />
          <h1>BookForge PDF</h1>
        </div>

        <div className="sidebar-content">
          {/* Templates */}
          <div className="form-group">
            <label><Sparkles /> Book Template (Global)</label>
            <div className="grid-3">
              {[
                { id: 'classic', label: 'Classic' },
                { id: 'modern', label: 'Modern' },
                { id: 'minimalist', label: 'Minimalist' },
                { id: 'theory', label: 'Theory Book' },
                { id: 'question', label: 'Question Bank' },
                { id: 'polity', label: 'Polity Exam' }
              ].map(tpl => (
                <div key={tpl.id}>
                  <input 
                    type="radio" 
                    id={`tpl-${tpl.id}`} 
                    name="template" 
                    value={tpl.id} 
                    checked={template === tpl.id}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="card-radio"
                  />
                  <label htmlFor={`tpl-${tpl.id}`} className="card-radio-label">
                    <LayoutTemplate size={18} style={{ marginBottom: 4 }} />
                    {tpl.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }} />

          {/* Page Size Settings */}
          <div className="form-group">
            <label><Layers /> Page Size (Global)</label>
            <div className="grid-3">
              {[
                { id: 'a4', label: 'A4' },
                { id: 'a5', label: 'A5' },
                { id: 'letter', label: 'Letter' }
              ].map(sz => (
                <div key={sz.id}>
                  <input 
                    type="radio" 
                    id={`ps-${sz.id}`} 
                    name="pageSize" 
                    value={sz.id} 
                    checked={pageSize === sz.id}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="card-radio"
                  />
                  <label htmlFor={`ps-${sz.id}`} className="card-radio-label">
                    {sz.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }} />

          {/* Font Size Settings */}
          <div className="form-group">
            <label><Type /> Content Text Size (Global)</label>
            <div className="grid-3">
              {[
                { id: 'micro', label: 'Micro' },
                { id: 'tiny', label: 'Tiny' },
                { id: 'small', label: 'Small' },
                { id: 'medium', label: 'Medium' },
                { id: 'large', label: 'Large' }
              ].map(sz => (
                <div key={sz.id}>
                  <input 
                    type="radio" 
                    id={`fs-${sz.id}`} 
                    name="fontSize" 
                    value={sz.id} 
                    checked={fontSize === sz.id}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="card-radio"
                  />
                  <label htmlFor={`fs-${sz.id}`} className="card-radio-label">
                    {sz.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }} />

          {/* Branding Settings */}
          <div className="form-group">
            <label><Type /> Footer Branding Name (Global)</label>
            <input type="text" className="form-control" value={brandingName} onChange={e => setBrandingName(e.target.value)} placeholder="e.g. MyBrand" />
          </div>
          <div className="form-group">
            <label><Type /> Footer Branding Link (Global)</label>
            <input type="text" className="form-control" value={brandingLink} onChange={e => setBrandingLink(e.target.value)} placeholder="e.g. https://example.com" />
          </div>

          <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }} />

          {/* Draft Form */}
          <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <label><Layers /> Current Page Layout</label>
            <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isGlobalLayout ? 'var(--primary)' : 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={isGlobalLayout} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsGlobalLayout(checked);
                  if (checked) {
                    setPages(prev => prev.map(p => ({ ...p, type: draftPage.type })));
                  }
                }}
              />
              Lock for all pages
            </label>
          </div>
          <select 
            className="form-control" 
            value={draftPage.type} 
            onChange={e => {
              const newType = e.target.value;
              handleUpdateDraft('type', newType);
              if (isGlobalLayout) {
                setPages(prev => prev.map(p => ({ ...p, type: newType })));
              }
            }}
            style={{ fontWeight: 600, color: 'var(--primary)', borderColor: 'var(--primary)', marginBottom: 8 }}
          >
            {PAGE_TYPES.map(pt => (
              <option key={pt.id} value={pt.id}>{pt.label}</option>
            ))}
          </select>

          {/* Text Inputs rendered dynamically based on type */}
          {(() => {
            switch (draftPage.type) {
              case 'cover':
                return (
                  <>
                    <div className="form-group">
                      <label><Type /> Book Title</label>
                      <input type="text" className="form-control" value={draftPage.title} onChange={e => handleUpdateDraft('title', e.target.value)} placeholder="Enter book title..." />
                    </div>
                    <div className="form-group">
                      <label><Type /> Subtitle</label>
                      <input type="text" className="form-control" value={draftPage.subtitle} onChange={e => handleUpdateDraft('subtitle', e.target.value)} placeholder="Enter subtitle..." />
                    </div>
                    <div className="form-group">
                      <label><User /> Author Name</label>
                      <input type="text" className="form-control" value={draftPage.author} onChange={e => handleUpdateDraft('author', e.target.value)} placeholder="Author name..." />
                    </div>
                  </>
                );
              case 'copyright':
                return (
                  <>
                    <div className="form-group">
                      <label><Type /> Publisher / Company</label>
                      <input type="text" className="form-control" value={draftPage.title} onChange={e => handleUpdateDraft('title', e.target.value)} placeholder="e.g. Acme Press" />
                    </div>
                    <div className="form-group">
                      <label><Type /> Year</label>
                      <input type="text" className="form-control" value={draftPage.subtitle} onChange={e => handleUpdateDraft('subtitle', e.target.value)} placeholder="e.g. 2024" />
                    </div>
                    <div className="form-group">
                      <label><User /> Rights Holder</label>
                      <input type="text" className="form-control" value={draftPage.author} onChange={e => handleUpdateDraft('author', e.target.value)} placeholder="e.g. Jane Doe" />
                    </div>
                    <div className="form-group">
                      <label><AlignLeft /> Copyright Info / ISBN</label>
                      <textarea className="form-control" value={draftPage.content} onChange={e => handleUpdateDraft('content', e.target.value)} placeholder="All rights reserved..." rows={5} />
                    </div>
                  </>
                );
              case 'chapter':
                return (
                  <>
                    <div className="form-group">
                      <label><Type /> Chapter Number / Subtitle</label>
                      <input type="text" className="form-control" value={draftPage.subtitle} onChange={e => handleUpdateDraft('subtitle', e.target.value)} placeholder="e.g. CHAPTER 1" />
                    </div>
                    <div className="form-group">
                      <label><Type /> Chapter Title</label>
                      <input type="text" className="form-control" value={draftPage.title} onChange={e => handleUpdateDraft('title', e.target.value)} placeholder="e.g. The Beginning" />
                    </div>
                  </>
                );
              case 'imagetext':
                return (
                  <>
                    <div className="form-group">
                      <label><Type /> Image URL</label>
                      <input type="text" className="form-control" value={draftPage.image || ''} onChange={e => handleUpdateDraft('image', e.target.value)} placeholder="https://example.com/image.jpg" />
                    </div>
                    <div className="form-group">
                      <label><Type /> Heading</label>
                      <input type="text" className="form-control" value={draftPage.title} onChange={e => handleUpdateDraft('title', e.target.value)} placeholder="Image Heading..." />
                    </div>
                    <div className="form-group">
                      <label><AlignLeft /> Page Content</label>
                      <textarea className="form-control" value={draftPage.content} onChange={e => handleUpdateDraft('content', e.target.value)} placeholder="Text below image..." rows={8} />
                    </div>
                  </>
                );
              case 'exam':
              case 'question':
              case 'mcq':
              case 'notes':
              case 'content':
              case 'twocolumn':
              case 'preface':
              case 'toc':
              case 'backcover':
                return (
                  <>
                    <div className="form-group">
                      <label><Type /> Heading / Title</label>
                      <input type="text" className="form-control" value={draftPage.title} onChange={e => handleUpdateDraft('title', e.target.value)} placeholder="Page Heading (Optional)..." />
                    </div>
                    <div className="form-group">
                      <label><AlignLeft /> Page Content</label>
                      <textarea className="form-control" value={draftPage.content} onChange={e => handleUpdateDraft('content', e.target.value)} placeholder="Content..." rows={10} />
                    </div>
                  </>
                );
              default:
            }
          })()}

          {/* Universal Floating Elements */}
          <hr style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }} />
          <div className="form-group">
            <label><Image size={16} /> Floating Image URL</label>
            <input type="text" className="form-control" value={draftPage.image || ''} onChange={e => handleUpdateDraft('image', e.target.value)} placeholder="Paste image URL here to freely drag it anywhere on the page..." />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><Type size={16} /> Floating Texts</span>
              <button 
                className="btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '12px' }} 
                onClick={() => {
                  const newTexts = [...(draftPage.floatingTexts || []), { id: Date.now(), text: 'New Text', x: 50, y: 150, size: 18 }];
                  handleUpdateDraft('floatingTexts', newTexts);
                }}
              >
                <Plus size={14} /> Add
              </button>
            </label>
            {(draftPage.floatingTexts || []).map((ft, idx) => (
               <div key={ft.id} style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                 <input 
                   type="text" 
                   className="form-control" 
                   value={ft.text} 
                   onChange={e => {
                      const newTexts = [...draftPage.floatingTexts];
                      newTexts[idx].text = e.target.value;
                      handleUpdateDraft('floatingTexts', newTexts);
                   }} 
                   placeholder="Type floating text here..."
                 />
                 <button 
                   className="btn-danger" 
                   style={{ padding: '4px 8px', borderRadius: '4px' }} 
                   onClick={() => {
                      const newTexts = draftPage.floatingTexts.filter((_, i) => i !== idx);
                      handleUpdateDraft('floatingTexts', newTexts);
                   }}
                   title="Remove floating text"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {editingPageId ? (
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setEditingPageId(null);
                  setDraftPage(prev => ({ type: isGlobalLayout ? prev.type : 'content', title: '', content: '' }));
                }} 
                style={{ flex: 1 }}
              >
                <Plus size={20} /> Add New Page Instead
              </button>
            ) : (
              <button className="btn-secondary" onClick={handleAddPage} style={{ flex: 1 }}>
                <Plus size={20} /> Add This Page To Book
              </button>
            )}
          </div>

          {/* List of Added Pages */}
          {pages.length > 0 && (
            <div className="form-group">
              <label><Layers /> Book Pages ({pages.length})</label>
              <div className="pages-list">
                {pages.map((p, i) => (
                  <div 
                    key={p.id} 
                    className={`page-list-item ${editingPageId === p.id ? 'editing-active-list' : ''}`}
                    onClick={() => handleEditPage(p)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="page-list-item-info">
                      <span className="page-list-badge">Page {i + 1} - {p.type}</span>
                      <span className="page-list-title">{p.title || '(No Title)'}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeletePage(p.id); }}
                      className="btn-danger"
                      title="Remove Page"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button 
            className="btn-primary" 
            onClick={handleDownloadPDF}
            disabled={isExporting || pages.length === 0}
            style={{ opacity: pages.length === 0 ? 0.5 : 1 }}
          >
            {isExporting ? 'Generating PDF...' : (
              <>
                <Download size={20} /> Export Book ({pages.length} Pages)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div 
        className={`preview-area ${isExporting ? 'pdf-exporting' : ''} ${isDragging ? 'dragging' : ''}`}
        ref={previewRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        
        {/* Zoom Controls */}
        {!isExporting && (
          <div className="zoom-controls">
            <button onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={18} /></button>
            <span>{zoom}%</span>
            <button onClick={handleZoomReset} title="Reset Zoom"><Maximize size={18} /></button>
            <button onClick={handleZoomIn} title="Zoom In"><ZoomIn size={18} /></button>
          </div>
        )}

        {/* Render all saved pages */}
        {!isExporting && pages.length > 0 && (
          <div className="preview-insert-btn" onClick={() => handleInsertPageAfter(-1)} style={{ width: `calc(var(--page-width) * ${zoom / 100})` }}>
            <div className="preview-insert-line"></div>
            <button className="btn-primary" style={{ borderRadius: '50%', padding: '0', margin: '0 20px', width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }} title="Insert Page at Beginning">
              <Plus size={24} />
            </button>
            <div className="preview-insert-line"></div>
          </div>
        )}

        {pages.map((page, index) => (
          <React.Fragment key={page.id}>
            <RenderPage 
              page={editingPageId === page.id ? draftPage : page} 
              index={index} 
              isDraft={false} 
            />
            {!isExporting && (
              <div className="preview-insert-btn" onClick={() => handleInsertPageAfter(index)} style={{ width: `calc(var(--page-width) * ${zoom / 100})` }}>
                <div className="preview-insert-line"></div>
                <button className="btn-primary" style={{ borderRadius: '50%', padding: '0', margin: '0 20px', width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }} title="Insert Page Here">
                  <Plus size={24} />
                </button>
                <div className="preview-insert-line"></div>
              </div>
            )}
          </React.Fragment>
        ))}
        
      </div>
    </div>
  );
}

export default App;
