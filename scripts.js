function sanitize(value) {
	// replace more than one whitespace with one space, double quotes with two double quotes
	var result = value.trim().replace(/\s+/g, ' ').replace(/"/g, '""');

	// if the string contains a semicolon or double quotes, quote the whole string
	if (/[;"]/.test(result)) {
		return '"' + result + '"';
	} else {
		return result;
	}
}

function sanitizeIBAN(IBAN) {
	return IBAN.trim().replace(/[^0-9a-zA-Z]+/g, '');
}

function sanitizeAmount(amount) {
	return amount.trim().replace('.', ',');
}

var $file = document.getElementById('file'),
	$upload = document.getElementById('upload'),
	$error = document.getElementById('error');

if (
	$file !== null &&
	'files' in $file &&
	$file.files instanceof FileList &&
	$upload !== null &&
	$error !== null
) {
	$upload.addEventListener('click', function () {
		$error.innerHTML = '';

		if ($file.files.length > 0) {
			var fileReader = new FileReader();
			var file = $file.files[0];

			fileReader.addEventListener('load', function (e) {
				var domParser = new DOMParser();

				var dom = domParser.parseFromString(fileReader.result, 'text/xml');

				var $parsererror = dom.querySelector('parsererror');

				if ($parsererror !== null) {
					$error.innerHTML = $parsererror.innerHTML;
				} else {
					var $creditorIBAN = dom.querySelector('CdtrAcct > Id > IBAN');
					var $creditorId = dom.querySelector('CdtrSchmeId > Id > PrvtId > Othr > Id');
					var debitType = 'Basis-Lastschrift';
					var mandateType = 'einmalig';
					var $debits = Array.from(dom.querySelectorAll('DrctDbtTxInf'));

					if (
						$creditorIBAN !== null &&
						$creditorId !== null &&
						$debits !== null &&
						$debits.length > 0
					) {
						var creditorIBAN = sanitizeIBAN($creditorIBAN.textContent);
						var creditorId = sanitize($creditorId.textContent);
						var debits = $debits.reduce(function (acc, $debit) {
							var $debitorName = $debit.querySelector('Dbtr > Nm');
							var $debitorIBAN = $debit.querySelector('DbtrAcct > Id > IBAN');
							var $debitorBIC = $debit.querySelector('DbtrAgt > FinInstnId > BIC');
							var $amount = $debit.querySelector('InstdAmt');
							var $mandateRef = $debit.querySelector('DrctDbtTx > MndtRltdInf > MndtId');
							var $dateOfSignature = $debit.querySelector('DrctDbtTx > MndtRltdInf > DtOfSgntr');
							var $reference = $debit.querySelector('RmtInf > Ustrd');

							if (
								$debitorName !== null &&
								$debitorIBAN !== null &&
								$debitorBIC !== null &&
								$amount !== null &&
								$mandateRef !== null &&
								$dateOfSignature !== null &&
								$reference !== null
							) {
								var debitorName = sanitize($debitorName.textContent);
								var debitorIBAN = sanitizeIBAN($debitorIBAN.textContent);
								var debitorBIC = sanitize($debitorBIC.textContent);
								var amount = sanitizeAmount($amount.textContent);
								var mandateRef = sanitize($mandateRef.textContent);
								var dateOfSignature = sanitize($dateOfSignature.textContent);
								var reference = sanitize($reference.textContent);
								var currency = $amount.getAttribute('Ccy');

								if (
									currency !== null &&
									currency === 'EUR' &&
									/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOfSignature) === true
								) {
									return acc.concat({
										debitorName: debitorName,
										debitorIBAN: debitorIBAN,
										debitorBIC: debitorBIC,
										amount: amount,
										mandateRef: mandateRef,
										dateOfSignature: dateOfSignature,
										reference: reference
									});
								}
							}

							return acc;
						}, []);

						if (debits.length > 0) {
							var csv = [
								[
									'Vorlagenbezeichnung',
									'IBAN des Zahlungsempfängers',
									'IBAN des Zahlungspflichtigen',
									'BIC',
									'Kreditinstitut',
									'Zahlungspflichtiger',
									'Straße',
									'Gebäude Nr.',
									'Postleitzahl',
									'Stadt',
									'Land',
									'Länderkennzeichen',
									'Betrag',
									'Verwendungszweck',
									'LastschriftArt',
									'Mandatsart',
									'Mandatsreferenz',
									'Gläubiger-ID',
									'unterschrieben am',
									'Abweichender Zahlungsempfänger'
								]
							]
								.concat(
									debits.map(function (debit) {
										return [
											debit.debitorName,
											creditorIBAN,
											debit.debitorIBAN,
											debit.debitorBIC,
											'',
											debit.debitorName,
											'',
											'',
											'',
											'',
											'',
											'',
											debit.amount,
											debit.reference,
											debitType,
											mandateType,
											debit.mandateRef,
											creditorId,
											debit.dateOfSignature,
											''
										];
									})
								)
								.map(function (row) {
									return row.join(';');
								})
								.join('\n');

							// Trigger downnload with a hidden link
							var hiddenElement = document.createElement('a');
							hiddenElement.href = 'data:text/csv,' + encodeURI(csv);
							hiddenElement.target = '_blank';
							hiddenElement.download = file.name.replace(/\.[^\.]+$/, '') + '.csv';
							hiddenElement.click();
						}
					}
				}
			});

			fileReader.readAsText(file);
		}
	});
}
