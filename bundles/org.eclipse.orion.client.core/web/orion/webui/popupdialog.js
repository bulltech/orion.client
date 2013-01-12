/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*jslint browser:true*/
/*global define orion window */

define(['i18n!orion/widgets/nls/messages', 'require', 'orion/webui/littlelib', 'orion/webui/tooltip'], 
		function(messages, require, lib, tooltip) {
	/**
	 * PopupDialog is used to implement a lightweight, automatically dismissed dialog in Orion that is triggered when
	 * clicking a DOM node.
	 * Clients use the PopupDialog prototype and implement the following behavior:
	 *    1.  Ensure that the HTML template for the popup content is defined in the prototype TEMPLATE variable
	 *        prior to calling the _initialize() function. Set the following fields in the dialog prior to calling the 
	 *        _initialize() function if applicable.
	 *
	 *        messages - If i18n message bindings are used in the template, set the messages field to the messages object that
	 *            should be used to bind strings.
	 * 
	 *    2.  To hook event listeners to elements in the dialog, implement the _bindToDOM function.  DOM elements
	 *        in the template will be bound to variable names prefixed by a '$' character.  For example, the
	 *        element with id "myElement" can be referenced with this.$myElement
	 *
	 * Usage: Not instantiated by clients.  The prototype is used by the application popup instance.
	 * 
	 * @name orion.webui.PopupDialog
	 */
	function PopupDialog() {
	}

	PopupDialog.prototype = /** @lends orion.webui.PopupDialog.prototype */ {
		
		/* 
		 * Called by clients once the popup dialog template has been bound to the TEMPLATE variable, and an optional message object has
		 * been set.
		 * @param {DOMElement} triggerNode The node that should trigger the popup.
		 * @param {Function} afterShowing Optional.  A function to call after the popup appears.
		 * @param {Function} afterHiding Optional.  A function to call after the popup is hidden.
		 */

		_initialize: function(triggerNode, afterShowing, afterHiding) {
			this._tooltip = new tooltip.Tooltip({
				node: triggerNode,
				hideDelay: 0,
				afterShowing: this._afterShowingFunction(afterShowing).bind(this), 
				afterHiding: afterHiding,
				trigger: "click" //$NON-NLS-0$
			});
			this.$parent = this._tooltip.contentContainer();
			var range = document.createRange();
			range.selectNode(this.$parent);
			var contentFragment = range.createContextualFragment(this.TEMPLATE);
			if (this.messages) {
				lib.processTextNodes(contentFragment, messages);
			}
			this.$parent.appendChild(contentFragment);
			var tip = this._tooltip;
			this.$parent.addEventListener("keydown", function (e) { //$NON-NLS-0$
				if(e.keyCode === lib.KEY.ESCAPE) {
					tip.hide();
				} 
			}, false);

			this._bindElements(this.$parent);
			if (typeof this._bindToDom === "function") { //$NON-NLS-0$
				this._bindToDom(this.$parent);
			}
		},
		
		/*
		 * Internal.  Binds any child nodes with id's to the matching field variables.
		 */
		_bindElements: function(node) {
			for (var i=0; i<node.childNodes.length; i++) {
				var child = node.childNodes[i];
				if (child.id) {
					this['$'+child.id] = child; //$NON-NLS-0$
				}
				this._bindElements(child);
			}
		},
		
		_afterShowingFunction: function(clientAfterShowing) {
			return function () {
				if (clientAfterShowing) {
					clientAfterShowing.bind(this)();
				}
				if (!this.customFocus) {
					// We should set the focus.  Pick the first tabbable field, otherwise don't change focus.
					var focusField = lib.firstTabbable(this.$parent);
					if (focusField) {
						focusField.focus();
					}
				}
			};
		},
		
		/*
		 * Internal.  Hides the dialog.  There are other cases where the tooltip can hide on its own,
		 * without a client calling this function.  
		 */
		hide: function() {
			this._tooltip.hide();
		}, 
		
		/*
		 * Internal.  Shows the dialog.  There are other cases where the tooltip can show on its own,
		 * without a client calling this function.
		 */
		show: function() {
			this._tooltip.show();
		}
	};
	
	PopupDialog.prototype.constructor = PopupDialog;

	//return the module exports
	return {PopupDialog: PopupDialog};
});
