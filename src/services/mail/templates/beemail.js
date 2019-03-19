// Header/footer/look/feel for beenest emails.
module.exports = ({
  greeting,
  introduction,
  instructions,
  properties,
  conclusion,
  notes,
  farewell,
  bookingId,
  listingId,
  to
}) => `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title></title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style type="text/css">
      body, table, td {
        font-family: Montserrat, Arial, sans-serif;
      }

      body, table {
        max-width: 600px;
        width: 100%;
        margin: 0 auto;
      }

      td {
        font-size: 15px;
        color: #455a64;
        margin: auto;
      }

      .email-header {
        padding: 24px 0px;
      }

      .support-link {
        color: #00969e;
        font-size: 18px;
        font-weight: 400;
        text-align: center;
        margin: auto;
        padding: 48px 0px;
        text-decoration: none;
        width: 100%;
        display: block;
      }

      .footer-link {
        text-decoration: none;
        padding: 0px 16px;
        color: lightgrey;
      }

      .message-detail, .category, .parameter, .farewell {
        font-weight: 300;
        line-height: 24px;
        padding-bottom: 8px;
      }

      .information {
        width: 50%;
        max-width: 600px;
        margin: 0 auto;
        text-align: left;
      }

      .greeting {
        font-size: 18px;
        font-weight: 500;
        padding: 16px 0px;
      }

      .booking-id {
        font-weight: 200;
        padding-top: 24px;
      }

      .divider {
        display: block;
        padding: 0px;
        margin: 16px 0px;
        height: 1px;
        background-color: #cfd8dc;
      }

      .content {
        margin: 0;
        padding: 0;
      }

      .avatar-container {
        margin-top: 24px;
      }
    
      .footer-legal {
        font-size: 14px;
        font-weight: 400;
        color: #263238;
        background-color: #FAFAFA;
        padding-top: 24px;
        padding-bottom: 0px !important;
      }
    </style>
    <!--[if gte mso 9]><xml>
    <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml><![endif]-->
  </head>
  <body>
    <div style="background-color:#FFF;">
      <!--[if gte mso 9]>
        <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
        <v:fill type="tile" color="#FFF"/>
        </v:background>
      <![endif]-->

      <table class="email-header" align="center">
        <tr>
          <td class="header-logo" align="left" valign="middle">
            <a class="logo-link" href="https://beenest.com" target="_blank" title="Beenest" style="width: 132px;  height: 24px;">
              <img src="https://static.beenest.com/images/email/beenest-horizontal-primary.png" alt="Beenest" width="132px" height="24px" style="width: 132px; height: 24px;" />
            </a>
          </td>
        </tr>
      </table>

      <table class="full-message">
        <tr><td class="divider"></td></tr>
        <tr>
          <td class="greeting">
            ${greeting || `Good day ${to.displayName},`}
          </td>
        </tr>
        <tr>
          <td class="message-detail">
            ${introduction}
          </td>
        </tr>
        ${instructions ? `<tr>
          <td class="message-detail">
            ${instructions}
          </td>
        </tr>` : ''}
      </table>
      ${properties ? `<table class="information">
        ${Object.entries(properties).map(([key, value]) => `
          <tr>
            <td class="category"><b>${key}:</b></td>
            <td class="parameter">${value}</td>
          </tr>
        `).join('\n')}
      </table>` : ''}
      <table class="full-message">
        ${conclusion ? `<tr>
          <td class="message-detail">
            ${conclusion}
          </td>
        </tr>` : ''}
        ${notes ? `<tr>
          <td class="message-detail">
            ${notes}
          </td>
        </tr>` : ''}
        ${bookingId ? `<tr>
          <td class="booking-id">
            <b>Booking ID: ${bookingId}</b>
          </td>
        </tr>` : ''}
        <tr>
          <td class="farewell">
            ${farewell || 'Thank You,<br>The Beenest Team'}
          </td>
        </tr>
        <tr><td class="divider"></td></tr>
      </table>

      <table class="beenest-support" cellspacing="0" border="0" cellpadding="">
        <tr>
          <td class="support-content" align="center" valign="middle">
            <table class="footer-support" align="center">
              <tr align="center">
                <td align="center" valign="middle">
                <a class="support-link" href="mailto:support@beenest.com?Subject=Customer Support Request${bookingId ? (' Booking ID: ' + bookingId) : ''}" title="Beenest Support"
                  target="_blank">
                  Have questions? Contact us at support@beenest.com
                </a>
              </tr>
            </table>
            <table class="footer-legal">
              <tr>
                <td class="content" width="auto" align="center" valign="top">
                  <br/>
                  <a href="https://beenest.com" title="Beenest Inc." target="_blank" width="132" height="24" style="width: 132px; height: 24px; margin: 0 auto; display: block;">
                    <img src="https://static.beenest.com/images/email/beenest-horizontal-primary.png" alt="Beenest Inc." width="132" height="24" style="width: 132px; height: 24px; ">
                  </a>
                  <br/>
                  <p class="address">
                    <strong>Beenest Inc.</strong>
                    <br/> 717 Market Street
                    <br/> San Francisco, CA 94103
                    <br/>
                    <br/>
                  </p>
                  <a class="footer-link" href="https://s3-us-west-2.amazonaws.com/beenest-public/legal/Beenest+-+Platform+Terms+of+Service.pdf" title="Terms of Use" target="_blank">
                    Terms of Service
                  </a>
                  <a class="footer-link" href="https://s3-us-west-2.amazonaws.com/beenest-public/legal/Beenest+-+Privacy+Policy.pdf" title="Privacy Policy" target="_blank">
                    Privacy Policy
                  </a>
                  <br/>
                  <br/>
                  <p class="legal-line">©2017-2019 Beenest Inc. All Rights Reserved.</p>
                  <br/>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>​
`;
