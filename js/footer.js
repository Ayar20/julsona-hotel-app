document.addEventListener("DOMContentLoaded", function() {
    fetch("footer.html")
        .then(response => response.text())
        .then(data => {
            // Create a container for the footer if it doesn't exist
            let footerContainer = document.getElementById("footer-container");
            if (!footerContainer) {
                footerContainer = document.createElement("div");
                footerContainer.id = "footer-container";
                document.body.appendChild(footerContainer);
            }
            footerContainer.innerHTML = data;
        });
});
