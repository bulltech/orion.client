/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*eslint-env browser, amd*/
define(['require', 'orion/xhr', 'orion/Deferred', 'orion/operation', 'orion/cfui/cFClient'],
 function(require, xhr, Deferred, operation, cFClient) {
 	
 	var cfService = new cFClient.CFService();
	
	var settings = {
		filePath : null,
		projectName : null,
		services : null
	};
	
	/* XHR communication */
	var contentType = "application/json; charset=UTF-8";
	
	var handleResponse = function(deferred, result) {
		var response =  result.response ? JSON.parse(result.response) : null;
			
		if (result.xhr && result.xhr.status === 202) {
			var def = operation.handle(response.Location);
			def.then(deferred.resolve, function(data) {
				data.failedOperation = response.Location;
				deferred.reject(data);
			}, deferred.progress);
			deferred.then(null, function(error){def.reject(error);});
			return;
		}
		deferred.resolve(response);
		return;
	};
	
	var getMetadata = function(){
		var d = new Deferred();
		xhr("GET", settings.filePath + '?parts=meta', { 
			headers : { 
				"Orion-Version" : "1",
				"Content-Type" : contentType
			},
			timeout : 15000,
			handleAs : "json" //$NON-NLS-0$
		}).then(function(resp) {
			handleResponse(d, resp);
		}, function(error){
			d.reject(error);
		});
		return d;
	};
	
	/* best effort to retrieve available service instances */
	var cacheServices = function(){
		if(settings.services === null){
			cfService.getTarget().then(function(target){
				cfService.getServices(target).then(function(resp){
										
					var services = resp.Children;
					settings.services = services;
				});
			});
		}
	};
	
	var getProjectName = function(name){
		if(name.indexOf(" | ") !== -1){
			var s = name.split(" | ");
			return s.length > 1 ?name.split(" | ")[1].trim() : name;
		} else
			return name;
	};
	
	var slugify = function(input){
		return input.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').trim();
	};
	
	var isEnabled = function(){
		var fileName = settings.filePath ? settings.filePath.split('/').pop() : null;
		return ["manifest.yml"].indexOf(fileName) !== -1;
	};
	
	var proposalCmp = function(p, q){
		return p.proposal.localeCompare(q.proposal);	
	};
	
	var getPositions = function(template){
		
		var positions = [];
		var matches = template.match(/<\w+>/g);
		matches.forEach(function(match){
			positions.push({
				offset : template.indexOf(match),
				length : match.length
			});
		});
		
		return positions;
	};
	
	var keywords = [
		'name: ', 'memory: ', 'memory: 256M', 'memory: 512M', 'memory: 1024M',
		'host: ', 'buildpack: ', 'command: ', 'instances: ', 'instances: 1', 
		'path: ', 'path: .', 'timeout: ', 'no-route: true', 'inherit: ',
		'domain: '
	];
	
	var lists = ['applications:', 'services:'];
	var objects = ['env:'];
	
	var manifestTemplate = [
		"---",
		"applications:",
		"- name: <name>",
		"  host: <host>",
		"  command: <command>",
		"  memory: 256M",
		"  instances: 1",
		"  path: ."
	];
	
	var cfManifestContentAssist = {
		
		computeContentAssist : function(editorContext, options){
			
			if(!isEnabled())
				return [];
			
			var proposals = [];
			var prefix = options.prefix;
			
			/* check if manifest template is required */
			if(options.offset === 0){
				
				if(settings.filePath !== null){
					var d = new Deferred();
					
					getMetadata().then(function(resp){
						
						var project = resp.Parents.pop();
						var projectName = getProjectName(project.Name);
						
						/* fill in host and application name */
						var proposal = manifestTemplate.join(options.delimiter);
						proposal = proposal.replace(/<name>/g, projectName);
						proposal = proposal.replace(/<host>/g, slugify(projectName));
						
						proposals.push({
							proposal : proposal,
							description : "Manifest template",
							positions : getPositions(proposal)
						});
						
						d.resolve(proposals.sort(proposalCmp));
						
					}, function(error){
						d.reject();
					});
					
					return d;
				}
				
				var proposal = manifestTemplate.join(options.delimiter);
				
				proposals.push({
					proposal : proposal,
					description : "Manifest template",
					positions : getPositions(proposal)
				});
				
				return proposals;
			}
			
			/* static keywords */
			keywords.forEach(function(keyword){
				if(keyword.indexOf(prefix) === 0){
					proposals.push({
						proposal : keyword.substring(prefix.length),
						description : keyword
					});
				}
			});
			
			/* list keywords */
			lists.forEach(function(keyword){
				if(keyword.indexOf(prefix) === 0){
					var delimiter = options.delimiter;
					
					var indentation = options.indentation;					
					var proposal = keyword.substring(prefix.length) +
						delimiter + indentation + "- ";
					
					proposals.push({
						proposal : proposal,
						description : keyword
					});
				}
			});
			
			/* object keywords */
			objects.forEach(function(keyword){
				if(keyword.indexOf(prefix) === 0){
					var delimiter = options.delimiter;
					
					var indentation = options.indentation;					
					var proposal = keyword.substring(prefix.length) +
						delimiter + indentation + "  ";
					
					proposals.push({
						proposal : proposal,
						description : keyword
					});
				}
			});
			
			/* add services as static keywords */
			if(settings.services !== null){
				settings.services.forEach(function(service){
					if(service.Name.indexOf(prefix) === 0){
						proposals.push({
							proposal : service.Name.substring(prefix.length),
							description : service.Name
						});
					}
				});
			}
			
			/* xhr properties */
			if(settings.filePath !== null){
				
				if("name: ".indexOf(prefix) === 0 || "host: ".indexOf(prefix) === 0 || "services: ".indexOf(prefix) === 0){
					var d = new Deferred();
					getMetadata().then(function(resp){
						
						var project = resp.Parents.pop();
						var projectName = getProjectName(project.Name);
						
						if("host: ".indexOf(prefix) === 0){
							proposals.unshift({
								proposal : "host: ".substring(prefix.length) + slugify(projectName),
								description : "host: " + slugify(projectName)
							});	
						}
						
						if("name: ".indexOf(prefix) === 0){
							proposals.unshift({
								proposal : "name: ".substring(prefix.length) + projectName,
								description : "name: " + projectName
							});
						}
						
						if("services: ".indexOf(prefix) === 0 && settings.services !== null){
							var delimiter = options.delimiter;
							var indentation = options.indentation;
							var proposal = "services: ".substring(prefix.length) +
								delimiter + indentation + "- ";
							
							settings.services.forEach(function(service){
								proposals.push({
									proposal : proposal + service.Name,
									description : "services: " + service.Name
								});
							});
						}
						
						d.resolve(proposals.sort(proposalCmp));
						
					}, function(error){
						d.reject(error);
					});
					
					return d;
				}
			}
			
			return proposals.sort(proposalCmp);
		}
	};
	
	var cfManifestValidator = {
		
		computeProblems : function(editorContext, options){
			
			/* set up file path */
			settings.filePath = options.title;
			
			if(!isEnabled()){
				return {
					problems : []
				};
			}
			
			/* cache whatever's possible */
			cacheServices();
			
			var problems = [];
			return editorContext.getText().then(function(contents){
				var lines = contents.split(/\r?\n/);
				
				/* missing command property should
				 * indicate a manifest warning */
				var missingCommand = true;
				var missingApplications = true;
				
				for(var i=0; i<lines.length; ++i){
					
					var line = lines[i];
					var lineNumber = i + 1; /* start with 1 */
					
					/* empty lines are fine */
					if(line.length === 0 || !line.trim())
						continue;
						
					/* check for incorrect indentation */
					if(!/(^[a-zA-Z\-].*)|(^ +[a-zA-Z\-].*)/.test(line)){
						
						var match = line.match(/^\s+/);
						var end = match !== null ? match[0].length + 1 : undefined;
						
						problems.push({
							description : "Invalid indentation: mixed spaces and tabs",
							line : lineNumber,
							start : 1,
							end : end
						});
					}
					
					/* check for incorrect memory units */
					if(/^ *memory: .*/.test(line) && !/^ *memory: [1-9][0-9]*(MB|GB|M|G)\s*$/.test(line)){
						
						var match = line.match(/^ */);
						var start = match !== null ? match[0].length + 1 : 1;
						
						problems.push({
							description : "Invalid memory unit",
							line : lineNumber,
							start : start,
							end : line.length + 1
						});
					}
					
					/* check for incorrect instances value */
					if(/^ *instances: .*/.test(line) && !/^ *instances: [1-9][0-9]*\s*$/.test(line)){
						
						var match = line.match(/^ */);
						var start = match !== null ? match[0].length + 1 : 1;
						
						problems.push({
							description : "Invalid application instances",
							line : lineNumber,
							start : start,
							end : line.length + 1
						});
					}
					
					/* check for incorrect timeout value */
					if(/^ *timeout: .*/.test(line) && !/^ *timeout: [1-9][0-9]*\s*$/.test(line)){
						
						var match = line.match(/^ */);
						var start = match !== null ? match[0].length + 1 : 1;
						
						problems.push({
							description : "Invalid application start timeout",
							line : lineNumber,
							start : start,
							end : line.length + 1
						});
					}
					
					/* check for incorrect no-route value */
					if(/^ *no-route: .*/.test(line) && !/^ *no-route: true\s*$/.test(line)){
						
						var match = line.match(/^ */);
						var start = match !== null ? match[0].length + 1 : 1;
						
						problems.push({
							description : "Invalid no-route property",
							line : lineNumber,
							start : start,
							end : line.length + 1
						});
					}
					
					if(/^ *command: .*/.test(line))
						missingCommand = false;
						
					if(/^ *applications:.*/.test(line))
						missingApplications = false;
				}
				
				if(missingCommand && !missingApplications){
					problems.push({
						description : "Missing application command",
						start : 0,
						severity: "warning"
					});
				}
				
				if(settings.filePath !== null){
					
					var d = new Deferred();
					
					cfService.getManifestInfo(settings.filePath).then(function(resp){
						/* nothing to do */
						d.resolve({ problems : problems });
					}, function(error){
						
						problems.push({
							description : error.Message,
							start : 0
						});
						
						d.resolve({ problems : problems });
					});
					
					return d;
				}
				
				return {
					problems : problems
				};
			});
		}
	};
	
	return {
		contentAssistImpl : cfManifestContentAssist,
		validatorImpl : cfManifestValidator
	};
});