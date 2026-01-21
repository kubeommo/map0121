// ============================
// 검색 및 지도 상호작용 로직
// ============================

// map.js에서 생성된 markerSource와 markerLayer를 사용
// addMarker 함수만 정의
function addMarker(lon, lat) {
    // 기존 마커 삭제 (항상 최신 핑만 유지)
    markerSource.clear();

    const marker = new ol.Feature({
        geometry: new ol.geom.Point(
            ol.proj.fromLonLat([lon, lat])
        )
    });

    marker.setStyle(iconStyle);
    markerSource.addFeature(marker);
}

// ============================
// 지도 클릭 시 마커 및 주소 표시
// ============================
if (map) {
    map.on('click', function (evt) {
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
// 검색 기능
// ============================
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

function performSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (!query) {
        alert('검색어를 입력하세요.');
        return;
    }

    fetch(`/api/proxy/search?address=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            const items = data.response?.result?.items;
            if (!items || items.length === 0) {
                alert('검색 결과를 찾을 수 없습니다.');
                return;
            }

            // 도로명 + 지번 주소 혼용 최적화
            let bestItem = items[0];
            let maxScore = -1;
            const cleanQuery = query.replace(/\s/g, '');

            items.forEach(item => {
                const originalTitle = item.title.replace(/<[^>]*>?/gm, '').trim();
                const noSpaceTitle = originalTitle.replace(/\s/g, '');
                let score = 0;

                if (noSpaceTitle === cleanQuery) score += 100;
                else if (noSpaceTitle.includes(cleanQuery) || cleanQuery.includes(noSpaceTitle)) score += 50;

                // 주소 길이가 짧을수록 점수 상승
                score += (100 - noSpaceTitle.length);

                // 지번/도로명 혼용 체크
                const addressString = (item.address?.road || item.address?.parcel || '').replace(/\s/g, '');
                if (addressString.includes(cleanQuery)) score += 20;

                if (score > maxScore) {
                    maxScore = score;
                    bestItem = item;
                }
            });

            const item = bestItem;
            const lon = parseFloat(item.point?.x);
            const lat = parseFloat(item.point?.y);

            if (isNaN(lon) || isNaN(lat)) {
                alert('유효한 좌표를 찾을 수 없습니다.');
                return;
            }

            const coordinate = ol.proj.fromLonLat([lon, lat]);
            markerSource.clear();
            addMarker(lon, lat);

            content.innerHTML = `
                <span style="font-weight:bold; color:#3498db;">[검색 결과]</span><br/>
                <span style="font-weight:bold;">${item.title}</span><br/>
                <span style="font-size:12px; color:#555;">${item.address?.road || item.address?.parcel || ''}</span>
                <p style="margin-top:8px; font-size:11px; color:#999; margin-bottom:0;">
                좌표: ${lon.toFixed(5)}, ${lat.toFixed(5)}</p>
            `;

            map.getView().cancelAnimations();
            map.getView().animate({
                center: coordinate,
                zoom: 17,
                duration: 800,
                easing: ol.easing.easeOut
            }, function(complete) {
                if (complete) overlay.setPosition(coordinate);
            });
        })
        .catch(err => {
            console.error('검색 수행 에러:', err);
            alert('검색 도중 서버 오류가 발생했습니다.');
        });
}

if (searchButton) searchButton.addEventListener('click', performSearch);
if (searchInput) searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') performSearch();
});
