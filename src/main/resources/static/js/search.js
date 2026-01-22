// ============================
// 검색 및 지도 상호작용 로직
// ============================

// map.js에서 생성된 markerSource와 markerLayer를 사용
// addMarker 함수만 정의
function addMarker(lon, lat) {
    markerSource.clear();

    const coordinate = ol.proj.fromLonLat([lon, lat]); // 좌표 변환 적용
    const marker = new ol.Feature({
        geometry: new ol.geom.Point(coordinate)
    });

    marker.setStyle(iconStyle);
    markerSource.addFeature(marker);
}

// ============================
// 지도 클릭 시 마커 및 주소 표시
// ============================
if (map) {
    map.on('click', function(evt) {
        const coord = ol.proj.toLonLat(evt.coordinate);
        const lon = coord[0];
        const lat = coord[1];

        addMarker(lon, lat);

        overlay.setPosition(evt.coordinate);
        content.innerHTML = `<p style="margin:0; font-size:13px; color:#666;">정보를 불러오는 중...</p>`;

        fetch(`/api/proxy/address?lon=${lon}&lat=${lat}`)
            .then(res => res.json())
            .then(data => {
                const result = (data.response ? data.response.result[0] : data.result?.[0]);
                if (result) {
                    const address = result.text;
                    const type = result.type === 'parcel' ? '지번 주소' : '도로명 주소';

                    content.innerHTML = `
                        <span style="font-weight:bold; color:#2ecc71;">[${type}]</span><br/>
                        ${address}<br/>
                        <p style="margin-top:8px; font-size:11px; color:#999; margin-bottom:0;">
                        좌표: ${lon.toFixed(5)}, ${lat.toFixed(5)}</p>
                    `;
                } else {
                    content.innerHTML = `
                        주소 정보를 찾을 수 없는 지역입니다.<br/>
                        <p style="margin-top:8px; font-size:11px; color:#999; margin-bottom:0;">
                        좌표: ${lon.toFixed(5)}, ${lat.toFixed(5)}</p>
                    `;
                }
            })
            .catch(err => {
                console.error('주소 변환 에러:', err);
                content.innerHTML = `<b>⚠️ 오류 발생</b><br/>서버 통신에 실패했습니다.`;
            });
    });
}

// ============================
// 검색 기능 (좌표 변환 적용)
// ============================
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

async function searchAddress() {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (!query) {
        alert('검색어를 입력하세요.');
        return;
    }

    try {
        const response = await fetch(`/api/proxy/search?address=${encodeURIComponent(query)}`);
        const result = await response.json();

        if (!result.response || !result.response.result || !result.response.result.items.length) {
            alert('검색 결과를 찾을 수 없습니다.');
            return;
        }

        const item = result.response.result.items[0];
        const lon = parseFloat(item.point.x);
        const lat = parseFloat(item.point.y);

        if (isNaN(lon) || isNaN(lat)) {
            alert('유효한 좌표를 찾을 수 없습니다.');
            return;
        }

        // 좌표 변환 (EPSG:4326 -> EPSG:3857)
        const coordinate = ol.proj.fromLonLat([lon, lat]);

        // 마커
        markerSource.clear();
        const feature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
        markerSource.addFeature(feature);

        // 팝업
        content.innerHTML = `
            <span style="font-weight:bold; color:#3498db;">[검색 결과]</span><br/>
            <span style="font-weight:bold;">${item.title}</span><br/>
            <span style="font-size:12px; color:#555;">${item.address?.road || item.address?.parcel || ''}</span>
            <p style="margin-top:8px; font-size:11px; color:#999; margin-bottom:0;">
            좌표: ${lon.toFixed(5)}, ${lat.toFixed(5)}</p>
        `;
        overlay.setPosition(coordinate);

        // 지도 이동
        map.getView().cancelAnimations();
        map.getView().animate({
            center: coordinate,
            zoom: 16,
            duration: 800
        });

    } catch (err) {
        console.error(err);
        alert('검색 중 오류가 발생했습니다.');
    }
}

if (searchButton) searchButton.addEventListener('click', searchAddress);
if (searchInput) searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchAddress();
});
