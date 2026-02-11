// Yapay Zeka Yorumlayıcısı JavaScript

// Global data değişkeni
let employeeData = [];

// Sayfa yüklendiğinde data.json'ı çek
async function loadData() {
    try {
        const response = await fetch('../data.json');
        if (!response.ok) {
            throw new Error('Data yüklenemedi');
        }
        employeeData = await response.json();
        console.log(`✅ ${employeeData.length} çalışan verisi yüklendi`);
    } catch (error) {
        console.error('Data yükleme hatası:', error);
        alert('Çalışan verileri yüklenemedi. Lütfen data.json dosyasının olduğundan emin olun.');
    }
}

// Örnek sorgular
const examples = {
    1: {
        prompt: "Toplam kaç çalışan var? Departman, işyeri ve pozisyon dağılımını göster."
    },
    2: {
        prompt: "COMPLETED ve ERROR statusundeki kayıtların oranını ve sayılarını analiz et."
    },
    3: {
        prompt: "En çok çalışan hangi departmanlarda? İlk 10 departmanı listele."
    },
    4: {
        prompt: "Çalışanların uyruk dağılımını analiz et. Hangi uyruktan kaç kişi var?"
    }
};

// Örnek yükle
function loadExample(exampleNumber) {
    const example = examples[exampleNumber];
    if (example) {
        document.getElementById('promptInput').value = example.prompt;
    }
}

// Temizle
function clearAll() {
    document.getElementById('promptInput').value = '';
    document.getElementById('outputArea').style.display = 'none';
    document.getElementById('resultContent').innerHTML = '';
}

// Veri analizi yap
async function analyzeData() {
    const promptInput = document.getElementById('promptInput').value;
    const loading = document.getElementById('loading');
    const outputArea = document.getElementById('outputArea');
    const resultContent = document.getElementById('resultContent');

    // Data kontrolü
    if (employeeData.length === 0) {
        alert('Çalışan verileri henüz yüklenmedi. Lütfen bekleyin ve tekrar deneyin.');
        await loadData();
        return;
    }

    // Validasyon
    if (!promptInput.trim()) {
        alert('Lütfen bir analiz sorusu veya talebi girin!');
        return;
    }

    // Loading göster
    loading.classList.add('active');
    outputArea.style.display = 'none';

    try {
        // Simüle edilmiş yapay zeka analizi
        await simulateAIAnalysis(promptInput);
        
        // Analiz yap
        const analysis = performAnalysis(employeeData, promptInput);
        
        // Sonuçları göster
        displayResults(analysis);
        
    } catch (error) {
        alert('Analiz sırasında bir hata oluştu: ' + error.message);
    } finally {
        loading.classList.remove('active');
        outputArea.style.display = 'block';
    }
}

// Yapay zeka analizini simüle et
function simulateAIAnalysis(prompt) {
    return new Promise(resolve => {
        setTimeout(resolve, 1500);
    });
}

// Çalışan verilerini analiz et
function performAnalysis(data, prompt) {
    const promptLower = prompt.toLowerCase();
    
    let analysis = {
        insights: [],
        statistics: {},
        charts: [],
        recommendations: []
    };
    
    // Genel istatistikler
    analysis.statistics.toplamCalisan = data.length;
    
    // Status analizi
    const statusCounts = {};
    data.forEach(emp => {
        const status = emp.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    analysis.statistics.statusDagilimi = statusCounts;
    
    // Başarı oranı
    const completed = statusCounts.COMPLETED || 0;
    const error = statusCounts.ERROR || 0;
    const basariOrani = ((completed / data.length) * 100).toFixed(2);
    analysis.insights.push(`✅ Toplam ${data.length} kayıt bulundu`);
    analysis.insights.push(`📊 Başarı Oranı: %${basariOrani} (${completed} COMPLETED / ${error} ERROR)`);
    
    // Departman analizi istendi mi?
    if (promptLower.includes('departman')) {
        const deptCounts = {};
        data.forEach(emp => {
            const dept = emp.departman || 'Bilinmiyor';
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
        
        const topDepts = Object.entries(deptCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        analysis.charts.push({
            title: '🏢 En Çok Çalışan Olan İlk 10 Departman',
            data: topDepts
        });
        
        analysis.insights.push(`📌 Toplam ${Object.keys(deptCounts).length} farklı departman tespit edildi`);
    }
    
    // İşyeri analizi
    if (promptLower.includes('işyeri') || promptLower.includes('isyeri')) {
        const workplaceCounts = {};
        data.forEach(emp => {
            const workplace = emp.isyeri || 'Bilinmiyor';
            workplaceCounts[workplace] = (workplaceCounts[workplace] || 0) + 1;
        });
        
        const topWorkplaces = Object.entries(workplaceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        analysis.charts.push({
            title: '🏥 En Çok Çalışan Olan İlk 10 İşyeri',
            data: topWorkplaces
        });
    }
    
    // Uyruk analizi
    if (promptLower.includes('uyruk')) {
        const nationalityCounts = {};
        data.forEach(emp => {
            const nat = emp.uyruk || 'Bilinmiyor';
            nationalityCounts[nat] = (nationalityCounts[nat] || 0) + 1;
        });
        
        const topNationalities = Object.entries(nationalityCounts)
            .sort((a, b) => b[1] - a[1]);
        
        analysis.charts.push({
            title: '🌍 Uyruk Dağılımı',
            data: topNationalities
        });
        
        analysis.insights.push(`🌐 ${Object.keys(nationalityCounts).length} farklı uyruktan çalışan mevcut`);
    }
    
    // Eğitim durumu analizi
    if (promptLower.includes('eğitim') || promptLower.includes('egitim')) {
        const educationCounts = {};
        data.forEach(emp => {
            const edu = emp.egitim || 'Bilinmiyor';
            educationCounts[edu] = (educationCounts[edu] || 0) + 1;
        });
        
        const topEducation = Object.entries(educationCounts)
            .sort((a, b) => b[1] - a[1]);
        
        analysis.charts.push({
            title: '🎓 Eğitim Durumu Dağılımı',
            data: topEducation
        });
    }
    
    // Pozisyon analizi
    if (promptLower.includes('pozisyon') || promptLower.includes('ünvan') || promptLower.includes('unvan')) {
        const positionCounts = {};
        data.forEach(emp => {
            const pos = emp.unvan || 'Bilinmiyor';
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        });
        
        const topPositions = Object.entries(positionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);
        
        analysis.charts.push({
            title: '💼 En Yaygın İlk 15 Ünvan',
            data: topPositions
        });
    }
    
    // Hata analizi
    if (promptLower.includes('hata') || promptLower.includes('error') || promptLower.includes('başarı')) {
        const errorData = data.filter(emp => emp.status === 'ERROR');
        const errorComments = {};
        
        errorData.forEach(emp => {
            const comment = emp.error_comment || 'Belirtilmemiş';
            errorComments[comment] = (errorComments[comment] || 0) + 1;
        });
        
        const topErrors = Object.entries(errorComments)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        analysis.charts.push({
            title: '❌ En Sık Karşılaşılan Hata Mesajları',
            data: topErrors
        });
        
        analysis.recommendations.push('⚠️ Tekrarlanan hata mesajlarını inceleyin ve sistemdeki sorunları giderin');
    }
    
    // Bordro türü analizi
    if (promptLower.includes('bordro')) {
        const bordroCounts = {};
        data.forEach(emp => {
            const bordro = emp.bordro || 'Bilinmiyor';
            bordroCounts[bordro] = (bordroCounts[bordro] || 0) + 1;
        });
        
        analysis.charts.push({
            title: '💰 Bordro Durumu',
            data: Object.entries(bordroCounts)
        });
    }
    
    // Genel öneriler
    if (error > completed * 0.3) {
        analysis.recommendations.push('⚠️ Hata oranı yüksek! Sistem entegrasyonunu kontrol edin');
    }
    
    analysis.recommendations.push('📊 Departman bazlı raporlama yaparak yönetim kararlarını destekleyin');
    analysis.recommendations.push('👥 Çalışan rotasyonunu ve iş gücü planlamasını optimize edin');
    
    return analysis;
}

// Sonuçları göster
function displayResults(analysis) {
    const resultContent = document.getElementById('resultContent');
    
    let html = '';
    
    // İçgörüler
    if (analysis.insights.length > 0) {
        html += `<div class="result-item">
            <h4>💡 Önemli İçgörüler</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
                ${analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
        </div>`;
    }
    
    // İstatistikler
    if (Object.keys(analysis.statistics).length > 0) {
        html += `<div class="result-item">
            <h4>📊 Temel İstatistikler</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">`;
        
        if (analysis.statistics.toplamCalisan) {
            html += `<li><strong>Toplam Çalışan:</strong> ${analysis.statistics.toplamCalisan.toLocaleString('tr-TR')}</li>`;
        }
        
        if (analysis.statistics.statusDagilimi) {
            html += `<li><strong>Status Dağılımı:</strong><ul style="margin-top: 5px;">`;
            Object.entries(analysis.statistics.statusDagilimi).forEach(([status, count]) => {
                html += `<li>${status}: ${count.toLocaleString('tr-TR')}</li>`;
            });
            html += `</ul></li>`;
        }
        
        html += `</ul></div>`;
    }
    
    // Grafikler / Tablolar
    if (analysis.charts && analysis.charts.length > 0) {
        analysis.charts.forEach(chart => {
            html += `<div class="result-item">
                <h4>${chart.title}</h4>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Kategori</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Sayı</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Oran</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            const total = chart.data.reduce((sum, item) => sum + item[1], 0);
            
            chart.data.forEach(([name, count]) => {
                const percentage = ((count / total) * 100).toFixed(1);
                html += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${count.toLocaleString('tr-TR')}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">%${percentage}</td>
                    </tr>`;
            });
            
            html += `</tbody></table></div>`;
        });
    }
    
    // Öneriler
    if (analysis.recommendations.length > 0) {
        html += `<div class="result-item">
            <h4>🎯 Öneriler ve Aksiyonlar</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
                ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>`;
    }
    
    resultContent.innerHTML = html;
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('🤖 Yapay Zeka Yorumlayıcısı başlatılıyor...');
    loadData();
});
