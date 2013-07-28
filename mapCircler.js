// 计算多边形的中心点
function PolygonCenter (poly) {
	var x,y;

	var vertices = poly.getPath();

	// Iterate over the vertices.
	for (var i=0, x=0, y=0; i < vertices.length; i++) {
		var xy = vertices.getAt(i);
		x = x + xy.lat();
		y = y + xy.lng();
	}
	x = x / vertices.length;
	y = y / vertices.length;
	return new google.maps.LatLng(x, y);
}

function regionCenter (jsonObj,regionOrder){

	var x1 = jsonObj.regions[regionOrder].paths[0].Lat;
	var y1 = jsonObj.regions[regionOrder].paths[0].Lng;
	var x2 = x1, y2 = y1;
	var x, y;
	
	for (i=0; i<jsonObj.regions[regionOrder].paths.length; i++){
		x = jsonObj.regions[regionOrder].paths[i].Lat;
		y = jsonObj.regions[regionOrder].paths[i].Lng;
		if (x < x1) {x1 = x};
		if (x > x2) {x2 = x};
		if (y < y1) {y1 = y};
		if (y > y2) {y2 = y};
	}

	return new google.maps.LatLng( (x1+x2)/2, (y1+y2)/2);
}

// 将html编码
function htmlEncode(str) {
	 var s = "";
	 if (str.length == 0) return "";
	 s = str.replace(/&/g, "&amp;");
	 s = s.replace(/</g, "&lt;");
	 s = s.replace(/>/g, "&gt;");  
	 s = s.replace(/\'/g, "&#39;");
	 s = s.replace(/\"/g, "&quot;");
	 return s;
}
// 查给定ID的单元所属区域序号
function getRegionOrder(jsonObj,ID){
	for (var k=0; k<jsonObj.regions.length; k++){
		if (jsonObj.regions[k].ID == ID) break;
	}
	if (k == jsonObj.regions.length) {return null}
	else {return k} 
}
// 查找指定多边形的位置，用zIndex作为索引值 
function getCurrentRegionElenemtzIndex(jsonObj, regionOrder, poly){
	for (var i = 0; i < jsonObj.regions[regionOrder].elements.length; i++) {
		if (poly.zIndex == jsonObj.regions[regionOrder].elements[i].ID) return i;
	}
	return null; 
}

// mode=true 为新建整个单元，
//  在指定的map上根据json数据画出指定区域regionOrder的指定单元index，jsonObj中的zIndex已经初始化
//  需要维护Blocks和Names两个数组。
// mode = false 为重画单元，将重画的内容替换Blocks和Names中的数据
// 最后全部加入双击响应程序
function drawBlockJson(map, jsonObj, regionOrder, index, mode){
	if (index >= jsonObj.regions[regionOrder].elements.length) return false;
	
	var indexObj = jsonObj.regions[regionOrder].elements[index];
	var path=[];
	for (var i =0; i < indexObj.paths.length; i++) {
		path.push(new google.maps.LatLng(indexObj.paths[i].Lat, indexObj.paths[i].Lng));
	}

	//initial zIndex,unique，新建时初始值已经初始化，不需要index填入
	var Block = new google.maps.Polygon({
		paths: path,
		strokeColor: jsonObj.mode[indexObj.mode].strokeColor,
		strokeOpacity: jsonObj.mode[indexObj.mode].strokeOpacity,
		strokeWeight: jsonObj.mode[indexObj.mode].strokeWeight,
		fillColor: jsonObj.mode[indexObj.mode].fillColor,
		fillOpacity: jsonObj.mode[indexObj.mode].fillOpactiy,
		zIndex: indexObj.ID
	});
	Block.setMap(map);
	
	// Add a listener for the click event
	// google.maps.event.addListener(Block, 'dblclick', editBlock);
	google.maps.event.addListener(Block, "rightclick", rightClickHandlerPoly);

	var image = 'http://chart.googleapis.com/chart?chst=d_text_outline&chld=FFFFFF|15|l|000000|_|'+ indexObj.name;
	var name_latlng = indexObj.name_pos; 
	if (typeof(name_latlng) == "undefined")
		name_latlng = PolygonCenter(Block);

	var nameMarker = new google.maps.Marker({
		position: name_latlng,
		map: map,
		icon: image
	});
	
	google.maps.event.addListener(nameMarker, "rightclick", rightClickHandler);

	if (mode){
		Blocks.push(Block);
		Names.push(nameMarker); 
	} else {
		Blocks.splice(index,1,Block);
		Names.splice(index,1,nameMarker);
	}; 

}

// 删除指定地图map的指定单元，需删除json、Blocks、Names中的数据，并将地图上单元和相关程序删除。
function deleBlockJson(map, jsonObj, regionOrder, index){
	if (index >= jsonObj.regions[regionOrder].length) return false;
 
	var p=Blocks[index];
	google.maps.event.clearInstanceListeners(p);
	p.setMap(null);
	Blocks.splice(index,index+1);

	var marker = Names[index];
	marker.setMap(null);
	Names.splice(index,index+1);

	jsonObj.regions[regionOrder].elements.splice(index,index+1);
}


// 将 poly 存入json中，并重画poly：先删除poly和相关的程序，再用json数据画出。
function addSubmit(regionOrder,poly){
	// 将 图 存入 jsonObj
	var elementLength = jsonObj.regions[regionOrder].elements.length;

	jsonObj.ID++;
	poly.zIndex = jsonObj.ID;

	jsonObj.regions[regionOrder].elements.push({"mode":0,"info":document.getElementById('item_meta').value,"name":document.getElementById('item_name').value, "ID":jsonObj.ID});
		
	var path = poly.getPath();

	jsonObj.regions[regionOrder].elements[elementLength].paths=[];
	for (i=0; i < path.length; i++){
		var xy = path.getAt(i);
		jsonObj.regions[regionOrder].elements[elementLength].paths.push({Lat:xy.lat(), Lng:xy.lng()});
	}

	// 删除画出的区域
	poly.setMap(null)
	google.maps.event.clearInstanceListeners(poly);
	poly = null;

	// 画出jsonObj中的区域并初始化
	drawBlockJson(map, jsonObj, regionOrder,elementLength,true);

}

// 修改了单元后，modify = true 检查是否需要更新其下属的区域相关内容，如果需要则更新内容。
// modify = false 删去其下属单元或并入上级单元。

function checkChildID(jsonObj, oldID, regionOrder, elementIndex,modify){
	var indexObj = jsonObj.regions[regionOrder].elements[elementIndex];
	var newID = indexObj.ID;
	if (modify) {
		for (i=0; i<jsonObj.regions.length; i++){
			if (jsonObj.regions[i].ID == oldID){
				jsonObj.regions[i].ID = newID;
				jsonObj.regions[i].paths = [];
				for (j=0; j<indexObj.paths.length; j++){
					jsonObj.regions[i].paths.push(indexObj.paths[j]);
				}
				break;
			}
		}
	} else {
		var found = false, deleteRegion = false;
		for (i=0; i<jsonObj.regions.length; i++){
			if (jsonObj.regions[i].ID == oldID){
				if (found) { 
					found = true;
					if (confirm("删除下属单元，不保留在上一级区域中")) deleteRegion = true;
				}
				if (deleteRegion) {
					jsonObj.regions.splice(i,i+1);
					i--;
				} else {
					
				}
			}
		}
	}
}

// 画指定区域，mode = true: 建立新的区域; mode = false: 重画该区域
function createRegion(map, jsonObj, regionOrder, mode){
	if (regionOrder >= jsonObj.regions.length) return false;

	if (mode) {
		Names = [];
		Blocks = [];
	}
	for (var j = 0; j < jsonObj.regions[regionOrder].elements.length; j++) { 
		//不需初始化ID，原始数据中已经有。	
		drawBlockJson(map, jsonObj, regionOrder, j, mode);
	};

	// 画外框
	var indexObj = jsonObj.regions[regionOrder];
	var path=[];
	for (var i =0; i < indexObj.paths.length; i++) {
		path.push(new google.maps.LatLng(indexObj.paths[i].Lat, indexObj.paths[i].Lng));
	}
	outFrame = new google.maps.Polygon({
		paths: path,
		strokeColor: jsonObj.mode[indexObj.mode].strokeColor,
		strokeOpacity: jsonObj.mode[indexObj.mode].strokeOpacity,
		strokeWeight: jsonObj.mode[indexObj.mode].strokeWeight,
		fillColor: jsonObj.mode[indexObj.mode].fillColor,
		fillOpacity: jsonObj.mode[indexObj.mode].fillOpactiy,
	});
	outFrame.setMap(map);
	google.maps.event.addListener(outFrame, "rightclick", rightClickHandler);
	
	map.setCenter(regionCenter(jsonObj,regionOrder));
	map.setZoom(jsonObj.zoom[jsonObj.regions[regionOrder].layer]);
	
}
// 在地图上删除当前区域，但不删除json的内容。
function deleteCurrentRegion(map){
	outFrame.setMap(null);
	google.maps.event.clearInstanceListeners(outFrame);
	for (i=0; i<Blocks.length; i++){
		var p = Blocks[i];
		google.maps.event.clearInstanceListeners(p);
		p.setMap(null);
	}
	for (i=0; i<Names.length; i++){
		Names[i].setMap(null);
	}
}

// 读入文件装入
function readFile(){
	if (!(window.File && window.FileReader && window.FileList)){
		// 如果不支持 HTML5 读取文件
		var text = prompt('请将文件内容粘贴到这里并按 Enter。','');
		if(text){
			jsonObj = JSON.parse(jsontext);
			deleteCurrentRegion(map);			
			currentRegionOrder = getRegionOrder(jsonObj, jsonObj.currentID);
			createRegion(map, jsonObj, currentRegionOrder, true);
		}
	}else{
		// 使用 HTML5 方式读取
		var $f = $('<input type="file" />').css('display', 'none');		
		var change = function(e){ //当选择一个文件的时候（事件 onchange）
			var file = e.target.files[0]; // FileList object 是一个数组，这里只取第一项
			console && console.log(file);

			var reader = new FileReader();

			// 读取文件完成时执行 onLoad 事件，先设置事件
			reader.onload = function(e){
				if(e.target.readyState == 2){
					jsonObj = JSON.parse(e.target.result);
					deleteCurrentRegion(map);
					currentRegionOrder = getRegionOrder(jsonObj, jsonObj.currentID);
					createRegion(map, jsonObj, currentRegionOrder, true);
				}else{ // 出错
					alert('读取文件时出错：'+ e.target.error);
				}
			};

			reader.readAsText(file);
		};
		$f.change(change).click();
	}

}

// 导出文件部分
function saveFile(){ // text, filename	
	saveAs(new Blob([JSON.stringify(jsonObj)], {type: "application/json;charset=utf-8"}), prompt('请输入文件名')+".mcf");
}

MapOverlay.prototype = new google.maps.OverlayView();
MapOverlay.prototype.onAdd = function() { }
MapOverlay.prototype.onRemove = function() { }
MapOverlay.prototype.draw = function() { }

function MapOverlay(map) { this.setMap(map); }

var map, jsonObj;
var outFrame, Names, Blocks;
var currentLayer, currentRegionOrder;
var drawingManager;
var mapOverlay;
// regions:[region1:{elements:[element1, ]}, region2, region3, ]
// 每个region区域包含多个element单元，区域的layer属性代表不同的层。
// 如layer=1是第一层，代表城市中的区，区包含多个街道；对街道细分居委，街道就是layer=2的区域，下面有多个街道。
// ID 是固定分配了，一个region的ID可以等于某个element的ID，这时这个region就是这个element的细化。ID没有0值。

jsonObj = {"currentID":1,"ID":5,
"file_version":1,
"mode":[{"strokeColor":"#FF0000", "strokeOpacity":0.8, "strokeWeight": 2, "fillColor":"#FF0000", "fillOpacity": 0.35},
		{"strokeColor":"#0000FF", "strokeOpacity":0.8, "strokeWeight": 1, "fillColor":"#FFFFFF", "fillOpacity": 0}],
"zoom":[13,15,17],

"regions":[
{"layer":0, "name":"汕头市", "name_pos":{"Lat":23.366289276203684,"Lng":116.69370043902586}, "mode":1,"info":"this is first","ID":1,
	"paths": [{"Lat":23.366289276203684,"Lng":116.69370043902586},
			{"Lat":23.358973538724012,"Lng":116.69387974077995},
			{"Lat":23.35882802626967,"Lng":116.68959584673303},
			{"Lat":23.353966744963618,"Lng":116.69252937089539},
			{"Lat":23.351178275762003,"Lng":116.69230244033815},
			{"Lat":23.35095971453859,"Lng":116.69940167980963},
			{"Lat":23.351940999956668,"Lng":116.70566082006837},
			{"Lat":23.352412,"Lng":116.716227},
			{"Lat":23.366387667050873,"Lng":116.71590533862309} ], 
 "elements":[
]}
] // regions
};


function initialize() {
// Construct my map
	currentRegionOrder = getRegionOrder(jsonObj, jsonObj.currentID);

	var latlng = regionCenter(jsonObj, currentRegionOrder);  //point of Shantou information mall
	var myOptions = {
			zoom: jsonObj.zoom[jsonObj.regions[currentRegionOrder].layer],
			center: latlng,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
	map = new google.maps.Map(document.getElementById("map_shantou"),myOptions);

// drawing tools on the map，draw a new poly
	drawingManager = new google.maps.drawing.DrawingManager({
		drawingMode: null,
		drawingControl: false,
		drawingControlOptions: {
			position: google.maps.ControlPosition.TOP_LEFT,
			drawingModes: [
			google.maps.drawing.OverlayType.POLYGON
			]},
		polygonOptions:jsonObj.mode[0]
		});
	drawingManager.setMap(map);

	google.maps.event.addListener(drawingManager, 'polygoncomplete', function(poly) {
		drawingManager.setDrawingMode(null);
		poly.setEditable(true);

		document.getElementById('item_name').value = '';
		document.getElementById('item_meta').value = '';
		document.getElementById("info").style.display="";
	
		google.maps.event.addDomListenerOnce(document.getElementById('item_acceptBtn'), 'click', function (){
			if(!document.getElementById('item_name').value){
				alert('请输入名称。');
			return false;
			};
			addSubmit(currentRegionOrder,poly);
			document.getElementById("info").style.display="none";
			$("#map_shantou").contextMenu(true);
			return false;
		});

		google.maps.event.addDomListenerOnce(document.getElementById('item_cancelBtn'), 'click', function (){
			// 删除画出的区域
			poly.setMap(null);
			poly = null;
			// 关闭对话窗口
			document.getElementById("info").style.display="none";
			$("#map_shantou").contextMenu(true);
			return false;
		});

		google.maps.event.addDomListenerOnce(document.getElementById('item_deleteBtn'), 'click', function (){
			// 删除画出的区域
			poly.setMap(null);
			poly = null;
			// 关闭对话窗口
			document.getElementById("info").style.display="none";
		$("#map_shantou").contextMenu(true);
			return false;
		});


		document.getElementById('item_name').focus();
	});

// create interactive window
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(document.getElementById('info'));

// Construct the layer
	createRegion(map, jsonObj, currentRegionOrder, true);

	// 处理菜单
	$.contextMenu({ 
		selector: '#map_shantou',
		build: function($trigger, e){
		//console.log(e);
		return {
		callback: function(key, options) {
			var func = {
				'load': function(){
					$("#map_shantou").contextMenu("hide");
					readFile();
					// return false;
				},
				'save': function(){
					$("#map_shantou").contextMenu("hide");
					saveFile();
					// return false;
				},
				'enter':function(){
					$("#map_shantou").contextMenu("hide");
					if (e.eventName != 'polygon') return;			
					var poly = e.originalThis;
					var newRegionOrder = getRegionOrder(jsonObj, poly.zIndex);
					if (newRegionOrder == null) {
						if (confirm("没有下一层，增加吗？")==false) return;				
						newRegionOrder = createNextRegion(poly);
					}
					deleteCurrentRegion(map);
					currentRegionOrder = newRegionOrder;
					createRegion(map, jsonObj, currentRegionOrder, true);
				},
				'return':function(){
					$("#map_shantou").contextMenu("hide");
					var newlayer = jsonObj.regions[currentRegionOrder].layer;
					var ID = jsonObj.regions[currentRegionOrder].ID;
					var newRegionOrder = null;

					if (newlayer == 0) return;
					for (j=0,newlayer--;  j < jsonObj.regions.length; j++){
						if (jsonObj.regions[j].layer != newlayer) continue;
						for (i=0; i < jsonObj.regions[j].elements.length; i++){
							if (jsonObj.regions[j].elements[i].ID == ID) {
								newRegionOrder = j;
								break;
							}
						}
					}

					if (newRegionOrder == null) return;
					deleteCurrentRegion(map);
					currentRegionOrder = newRegionOrder;
					createRegion(map, jsonObj, currentRegionOrder, true);
					return false;
				},
				'edit':function(){
					$("#map_shantou").contextMenu("hide");
					
					if (e.eventName == 'polygon') {
						$("#map_shantou").contextMenu(false);
						editBlock.call(e.originalThis);
					}
				},
				'new':function(){
					$("#map_shantou").contextMenu("hide");
					$("#map_shantou").contextMenu(false);
					drawingManager.setDrawingMode("polygon");
				},
				'frame':function(){
					reurn;
				}
			};
			return func[key] && func[key]();//if(func[key]){func();}
		},
		items: {
			"load": {name: "打开文件"},
				"save": {name: "保存文件"},
				"sep1": "---------",
				"enter": {name: "进入下一层"},
				"return": {name: "返回上一层"},
				"sep2": "---------",
				"edit": {name: "编辑本单元", icon: "edit"},
				"new": {name: "新建单元", icon: "add"},
				"frame":{name:"编辑边界"}
			}
		}}
	});
	
	google.maps.event.addListener(map, "rightclick", rightClickHandler);

	mapOverlay = new MapOverlay(map);
}

// 右键处理程序，对应在多边形上点击
function rightClickHandlerPoly(e){
	var ev = new jQuery.Event('contextmenu');
	
	if(e.pixel){
		ev.pageX = e.pixel.x;
		ev.pageY = e.pixel.y;
	}else if(e.Ja){
		ev.pageX = e.Ja.pageX;
		ev.pageY = e.Ja.pageY;	
	}else{
		var p = mapOverlay.getProjection().fromLatLngToContainerPixel(e.latLng);

			ev.pageX = p.x;
			ev.pageY = p.y;
		if(!ev.pageX) window.console ? console.error('Cursor position not found!') : alert('Cursor position not found!');
	}
	// contextMenuEvent = e;

	ev.originalThis = this;
	ev.latLng = e.latLng;
	ev.eventName = 'polygon';

	$('#map_shantou').trigger(ev);
}
// 右键处理程序，对应在其他区域上点击
function rightClickHandler(e){
	// console.log(e);
	var ev = new jQuery.Event('contextmenu');
	
	if(e.pixel){
		ev.pageX = e.pixel.x;
		ev.pageY = e.pixel.y;
	}else if(e.Ja){
		ev.pageX = e.Ja.pageX;
		ev.pageY = e.Ja.pageY;	
	}else{
		var p = mapOverlay.getProjection().fromLatLngToContainerPixel(e.latLng);

		ev.pageX = p.x;
		ev.pageY = p.y;
		if(!ev.pageX) window.console ? console.error('Cursor position not found!') : alert('Cursor position not found!');
	}
	// contextMenuEvent = e;

	ev.originalThis = this;
	ev.latLng = e.latLng;	
	
	$('#map_shantou').trigger(ev);
}

// 生成下一级区域初始化数据
function createNextRegion(poly){
	var elementOrder = getCurrentRegionElenemtzIndex(jsonObj,currentRegionOrder,poly);	
	if (elementOrder == null) return;
	var thisElement = jsonObj.regions[currentRegionOrder].elements[elementOrder];
	var newlayer = jsonObj.regions[currentRegionOrder].layer	+1;
	var newRegionOrder = jsonObj.regions.length;
	thisElement.mode = 2;	
	jsonObj.regions.push({"layer":newlayer, "name":thisElement.name, "mode":1,"info":thisElement.info,"ID":thisElement.ID});
	jsonObj.regions[newRegionOrder].paths = [];
	for (i=0; i<thisElement.paths.length; i++){
		jsonObj.regions[newRegionOrder].paths.push(thisElement.paths[i]);
	}
	jsonObj.regions[newRegionOrder].elements = [];
	return newRegionOrder;
}

// modify the Block: set the poly editable, open info, when done, replace info or dele the poly
function editBlock(event) {
	event && event.stop();// 停止默认的放大行为的执行
	var poly = this;
	var elementIndex = getCurrentRegionElenemtzIndex(jsonObj,currentRegionOrder,poly);

	poly.setEditable(true);
	
	document.getElementById('item_name').value = jsonObj.regions[currentRegionOrder].elements[elementIndex].name;
	document.getElementById('item_meta').value = jsonObj.regions[currentRegionOrder].elements[elementIndex].info;
	$("#info").show();
	
	google.maps.event.addDomListenerOnce(document.getElementById('item_acceptBtn'), 'click', function (){
		if(!document.getElementById('item_name').value){
			alert('请输入名称。');
			return false;
		};
		
		// 删除指定的原图
		var oldID = jsonObj.regions[currentRegionOrder].elements[elementIndex].ID;
		deleBlockJson(map, jsonObj, currentRegionOrder,elementIndex);
		// 将图存入 jsonObj,并重画
		addSubmit(currentRegionOrder,poly);
		elementIndex = jsonObj.regions[currentRegionOrder].elements.length -1;
		checkChildID(jsonObj, oldID, currentRegionOrder, elementIndex, true);

		document.getElementById("info").style.display="none";
		$("#map_shantou").contextMenu(true);
		return false;
	});
	// 删除改变的图，重画原图。
	google.maps.event.addDomListenerOnce(document.getElementById('item_cancelBtn'), 'click', function (){
		poly.setMap(null);
		google.maps.event.clearInstanceListeners(poly);
		Poly = null;

		drawBlockJson(map, jsonObj, currentRegionOrder,elementIndex,false);
		$("#info").hide();
		$("#map_shantou").contextMenu(true);
		return false;
	});

	google.maps.event.addDomListenerOnce(document.getElementById('item_deleteBtn'), 'click', function (){
		var oldID = jsonObj.regions[currentRegionOrder].elements[elementIndex].ID;
		checkChildID(jsonObj, oldID, currentRegionOrder, elementIndex, false);//BUG***
		deleBlockJson(map, jsonObj, currentRegionOrder,elementIndex);
		document.getElementById("info").style.display="none";
		$("#map_shantou").contextMenu(true);
		return false;
	});


	document.getElementById('item_name').focus();
}